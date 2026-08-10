import { DurableObject } from 'cloudflare:workers'
import { isSubscriptionGone, sendPush } from './push'

export interface Env {
  DB: D1Database
  ACTIVITY: DurableObjectNamespace<ActivityFeed>
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>
  // Plain var in wrangler.toml: browsers are handed this to subscribe with,
  // so it is public by design.
  VAPID_PUBLIC_KEY: string
  // Secret, set with `wrangler secret put VAPID_PRIVATE_KEY`. Never in the
  // repository, and not recoverable from Cloudflare once set.
  VAPID_PRIVATE_KEY: string
}

// Mirrors src/game/stats.ts: VALUE_BUCKETS on the frontend, and the same
// set of board sizes free play (20) and the daily challenge (10/15/25/30)
// ever produce.
const VALUE_BUCKETS = 10
const VALID_BOARD_SIZES = new Set([10, 15, 20, 25, 30])
// Mirrors src/game/types.ts: the range every rolled number falls in.
const MIN_VALUE = 1
const MAX_VALUE = 1000

const ALLOWED_ORIGIN = 'https://jacobbpp.github.io'

// Identifies a device across the streak leaderboard, the game log, and
// per-device placements — never shown anywhere and carries no other
// identity. Names alone aren't a safe key: two different devices can both
// pick "TOM", so the client generates and keeps its own random deviceId
// (order20-device-id in localStorage) instead.
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

interface PlacementEntry {
  position: number
  valueBucket: number
}

function isValidEntry(entry: unknown, boardSize: number): entry is PlacementEntry {
  if (!entry || typeof entry !== 'object') return false
  const { position, valueBucket } = entry as Record<string, unknown>
  return (
    typeof position === 'number' &&
    Number.isInteger(position) &&
    position >= 0 &&
    position < boardSize &&
    typeof valueBucket === 'number' &&
    Number.isInteger(valueBucket) &&
    valueBucket >= 0 &&
    valueBucket < VALUE_BUCKETS
  )
}

// One request per completed game rather than one per placement — a board
// has at most 30 positions, so that's also the request's natural cap.
const MAX_PLACEMENTS_PER_REQUEST = 30

function isValidBatch(body: unknown): body is { boardSize: number; placements: PlacementEntry[]; deviceId?: string } {
  if (!body || typeof body !== 'object') return false
  const { boardSize, placements, deviceId } = body as Record<string, unknown>
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  if (!Array.isArray(placements) || placements.length === 0 || placements.length > MAX_PLACEMENTS_PER_REQUEST) return false
  if (deviceId !== undefined && (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId))) return false
  return placements.every(entry => isValidEntry(entry, boardSize))
}

// D1 caps bound parameters at 100 per query, and counts every statement in
// a batch — not the batch itself — against the runtime's per-invocation
// query limit (50 on the free plan, 1000 on paid; see
// developers.cloudflare.com/d1/platform/limits). One INSERT per row would
// have made a 30-position board (the largest any game produces) cost up to
// 30 statements per table, so this builds one multi-row INSERT per chunk of
// rows instead — a handful of statements per table regardless of board
// size, and immune to which D1 plan the account happens to be on. Every row
// here ends in a literal `1` for `count`, matching both callers' upsert
// shape (start at 1, increment on conflict).
function buildUpsertStatements(env: Env, insertPrefix: string, conflictSuffix: string, rows: (string | number)[][]): D1PreparedStatement[] {
  if (rows.length === 0) return []
  const columnsPerRow = rows[0].length
  const rowsPerChunk = Math.floor(100 / columnsPerRow)
  const statements: D1PreparedStatement[] = []

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    const chunk = rows.slice(start, start + rowsPerChunk)
    const tuples = chunk
      .map((_, i) => `(${Array.from({ length: columnsPerRow }, (_, c) => `?${i * columnsPerRow + c + 1}`).join(', ')}, 1)`)
      .join(', ')
    statements.push(env.DB.prepare(`${insertPrefix} VALUES ${tuples} ${conflictSuffix}`).bind(...chunk.flat()))
  }

  return statements
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidBatch(body)) {
    return json({ error: 'boardSize and placements (position, valueBucket, in range) are required.' }, 400)
  }

  const { boardSize, placements, deviceId } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  const statements = buildUpsertStatements(
    env,
    'INSERT INTO placements (board_size, position, value_bucket, count)',
    'ON CONFLICT (board_size, position, value_bucket) DO UPDATE SET count = count + 1',
    placements.map(entry => [boardSize, entry.position, entry.valueBucket]),
  )

  // Mirrors the same rows into a per-device table so a favorite position
  // ("most liked area") can be read back per player, not just as an
  // anonymous community-wide total. Optional purely so an older cached
  // client without a deviceId yet doesn't fail this request.
  if (deviceId) {
    statements.push(
      ...buildUpsertStatements(
        env,
        'INSERT INTO device_placements (device_id, board_size, position, value_bucket, count)',
        'ON CONFLICT (device_id, board_size, position, value_bucket) DO UPDATE SET count = count + 1',
        placements.map(entry => [deviceId, boardSize, entry.position, entry.valueBucket]),
      ),
    )
  }

  await env.DB.batch(statements)

  return new Response(null, { status: 204, headers: corsHeaders() })
}

async function handleSummary(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const boardSizeParam = url.searchParams.get('boardSize')
  const boardSize = boardSizeParam ? Number(boardSizeParam) : 20

  if (!VALID_BOARD_SIZES.has(boardSize)) {
    return json({ error: 'Unknown boardSize.' }, 400)
  }

  const { results } = await env.DB.prepare('SELECT position, value_bucket, count FROM placements WHERE board_size = ?1')
    .bind(boardSize)
    .all<{ position: number; value_bucket: number; count: number }>()

  const matrix: number[][] = Array.from({ length: boardSize }, () => Array(VALUE_BUCKETS).fill(0))
  for (const row of results) {
    if (row.position >= 0 && row.position < boardSize && row.value_bucket >= 0 && row.value_bucket < VALUE_BUCKETS) {
      matrix[row.position][row.value_bucket] = row.count
    }
  }

  return json({ boardSize, matrix })
}

type LeaderboardWindow = 'day' | 'week' | 'month' | 'all'
const LEADERBOARD_WINDOWS = new Set<string>(['day', 'week', 'month', 'all'])

// UTC calendar boundaries, so the board resets at the same instant for
// every player regardless of their own timezone — same anchoring the daily
// challenge already uses for "today".
function windowCutoff(window: LeaderboardWindow): string | null {
  const now = new Date()
  if (window === 'all') return null
  if (window === 'day') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  }
  if (window === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  }
  // week: most recent UTC Monday (ISO week start).
  const day = now.getUTCDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday)).toISOString()
}

// The score sitting in 10th place for a window — null means fewer than 10
// games exist yet, so any score clears the bar. One row per game, not per
// player: a player with several genuinely good games can hold more than
// one of the ten spots, same as the leaderboard itself.
async function tenthPlaceScore(env: Env, boardSize: number, window: LeaderboardWindow): Promise<number | null> {
  const cutoff = windowCutoff(window)
  const query = cutoff
    ? env.DB.prepare('SELECT score FROM scores WHERE board_size = ?1 AND created_at >= ?2 ORDER BY score DESC LIMIT 1 OFFSET 9').bind(
        boardSize,
        cutoff,
      )
    : env.DB.prepare('SELECT score FROM scores WHERE board_size = ?1 ORDER BY score DESC LIMIT 1 OFFSET 9').bind(boardSize)
  const row = await query.first<{ score: number }>()
  return row ? row.score : null
}

interface ScoreCheckBody {
  boardSize: number
  score: number
}

function isValidScoreCheck(body: unknown): body is ScoreCheckBody {
  if (!body || typeof body !== 'object') return false
  const { boardSize, score } = body as Record<string, unknown>
  return (
    typeof boardSize === 'number' &&
    VALID_BOARD_SIZES.has(boardSize) &&
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= boardSize
  )
}

// Tells the caller which leaderboard windows a just-finished score would
// currently place top 10 in, before anything is written — the frontend
// only shows the name prompt when this comes back non-empty.
async function handleScoreCheck(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidScoreCheck(body)) {
    return json({ error: 'boardSize and score (1..boardSize) are required.' }, 400)
  }

  const { boardSize, score } = body
  const windows: LeaderboardWindow[] = ['day', 'week', 'month', 'all']
  const thresholds = await Promise.all(windows.map(window => tenthPlaceScore(env, boardSize, window)))
  const qualifying = windows.filter((_, i) => thresholds[i] === null || score >= (thresholds[i] as number))

  return json({ windows: qualifying })
}

interface ScoreSubmitBody {
  boardSize: number
  name: string
  score: number
  board?: (number | null)[] | null
  endingRoll?: number | null
  // Only ever used to rate limit per player instead of per household; never
  // stored against the score and never shown. Optional so a client cached
  // from before this still submits fine.
  deviceId?: string
}

const NAME_PATTERN = /^[A-Za-z0-9 ]+$/

// Exact board a game finished with — index is the board position, value is
// the number placed there (or null if it was never filled). Optional so
// older cached clients that haven't picked up this change yet can still
// submit a score without one; it just won't have a board to show later.
function isValidBoard(board: unknown, boardSize: number): board is (number | null)[] {
  if (!Array.isArray(board) || board.length !== boardSize) return false
  return board.every(v => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= MIN_VALUE && v <= MAX_VALUE))
}

// The roll that had nowhere to go and ended the game — null for a win, or
// for a score submitted before this field existed.
function isValidEndingRoll(endingRoll: unknown): endingRoll is number | null {
  return endingRoll === null || (typeof endingRoll === 'number' && Number.isInteger(endingRoll) && endingRoll >= MIN_VALUE && endingRoll <= MAX_VALUE)
}

function isValidScoreSubmit(body: unknown): body is ScoreSubmitBody {
  if (!body || typeof body !== 'object') return false
  const { boardSize, name, score, board, endingRoll, deviceId } = body as Record<string, unknown>
  if (deviceId !== undefined && (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId))) return false
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > boardSize) return false
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 8 || !NAME_PATTERN.test(trimmed)) return false
  if (!(board === undefined || board === null || isValidBoard(board, boardSize))) return false
  return endingRoll === undefined || isValidEndingRoll(endingRoll)
}

async function handleScoreSubmit(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidScoreSubmit(body)) {
    return json(
      { error: 'boardSize, name (1-8 letters/digits/spaces), score (1..boardSize), and an optional matching board/endingRoll are required.' },
      400,
    )
  }

  const { boardSize, name, score, board, endingRoll, deviceId } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  const cleanName = name.trim().toUpperCase()
  const boardJson = Array.isArray(board) ? JSON.stringify(board) : null

  await env.DB.prepare('INSERT INTO scores (board_size, name, score, board, ending_roll, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(boardSize, cleanName, score, boardJson, endingRoll ?? null, new Date().toISOString())
    .run()

  return new Response(null, { status: 204, headers: corsHeaders() })
}

async function handleLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const boardSizeParam = url.searchParams.get('boardSize')
  const boardSize = boardSizeParam ? Number(boardSizeParam) : 20
  const windowParam = url.searchParams.get('window') ?? 'all'

  if (!VALID_BOARD_SIZES.has(boardSize)) {
    return json({ error: 'Unknown boardSize.' }, 400)
  }
  if (!LEADERBOARD_WINDOWS.has(windowParam)) {
    return json({ error: 'Unknown window.' }, 400)
  }

  const window = windowParam as LeaderboardWindow
  const cutoff = windowCutoff(window)
  // One row per game, not per player — a player with several genuinely
  // good games can hold more than one of the ten spots.
  const query = cutoff
    ? env.DB.prepare(
        `SELECT id, name, score, board, ending_roll FROM scores
         WHERE board_size = ?1 AND created_at >= ?2
         ORDER BY score DESC, created_at ASC LIMIT 10`,
      ).bind(boardSize, cutoff)
    : env.DB.prepare(
        `SELECT id, name, score, board, ending_roll FROM scores
         WHERE board_size = ?1
         ORDER BY score DESC, created_at ASC LIMIT 10`,
      ).bind(boardSize)

  const { results } = await query.all<{ id: number; name: string; score: number; board: string | null; ending_roll: number | null }>()
  const entries = results.map(({ id, name, score, board, ending_roll }) => ({ id, name, score, board: parseBoard(board), endingRoll: ending_roll }))
  return json({ boardSize, window, entries })
}

function parseBoard(boardJson: string | null): (number | null)[] | null {
  if (!boardJson) return null
  try {
    const parsed: unknown = JSON.parse(boardJson)
    return Array.isArray(parsed) ? (parsed as (number | null)[]) : null
  } catch {
    return null
  }
}

// Daily challenge leaderboard — unlike free play there's no day/week/month/
// all-time window: the board size changes every day, so only players who
// played the exact same challenge are comparable. Everyone gets one row per
// calendar date, so there's also no need to group/dedup by player the way
// free play's GROUP BY-removal fix cared about.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

async function dailyTenthPlaceScore(env: Env, boardSize: number, date: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT score FROM daily_scores WHERE board_size = ?1 AND challenge_date = ?2 ORDER BY score DESC LIMIT 1 OFFSET 9')
    .bind(boardSize, date)
    .first<{ score: number }>()
  return row ? row.score : null
}

interface DailyScoreCheckBody {
  boardSize: number
  date: string
  score: number
}

function isValidDailyScoreCheck(body: unknown): body is DailyScoreCheckBody {
  if (!body || typeof body !== 'object') return false
  const { boardSize, date, score } = body as Record<string, unknown>
  return (
    typeof boardSize === 'number' &&
    VALID_BOARD_SIZES.has(boardSize) &&
    typeof date === 'string' &&
    DATE_PATTERN.test(date) &&
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= boardSize
  )
}

async function handleDailyScoreCheck(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidDailyScoreCheck(body)) {
    return json({ error: 'boardSize, date (YYYY-MM-DD), and score (1..boardSize) are required.' }, 400)
  }

  const { boardSize, date, score } = body
  const threshold = await dailyTenthPlaceScore(env, boardSize, date)
  return json({ qualifies: threshold === null || score >= threshold })
}

interface DailyScoreSubmitBody {
  boardSize: number
  date: string
  name: string
  score: number
  board?: (number | null)[] | null
  endingRoll?: number | null
  durationMs?: number | null
  // As with free play: used only for rate limiting, never stored.
  deviceId?: string
}

// A day is the ceiling: the clock pauses whenever the app isn't in front of
// the player, so a genuine run can span hours of wall time but never this
// much of actual play.
const MAX_DURATION_MS = 24 * 60 * 60 * 1000

// Optional, because a client cached from before the daily was timed still
// submits perfectly valid scores without one.
function isValidDuration(durationMs: unknown): durationMs is number | null {
  if (durationMs === null) return true
  return typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= MAX_DURATION_MS
}

function isValidDailyScoreSubmit(body: unknown): body is DailyScoreSubmitBody {
  if (!body || typeof body !== 'object') return false
  const { boardSize, date, name, score, board, endingRoll, durationMs, deviceId } = body as Record<string, unknown>
  if (deviceId !== undefined && (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId))) return false
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return false
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > boardSize) return false
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 8 || !NAME_PATTERN.test(trimmed)) return false
  if (!(board === undefined || board === null || isValidBoard(board, boardSize))) return false
  if (!(endingRoll === undefined || isValidEndingRoll(endingRoll))) return false
  return durationMs === undefined || isValidDuration(durationMs)
}

async function handleDailyScoreSubmit(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidDailyScoreSubmit(body)) {
    return json(
      { error: 'boardSize, date (YYYY-MM-DD), name (1-8 letters/digits/spaces), score (1..boardSize), and an optional matching board/endingRoll are required.' },
      400,
    )
  }

  const { boardSize, date, name, score, board, endingRoll, durationMs, deviceId } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  const cleanName = name.trim().toUpperCase()
  const boardJson = Array.isArray(board) ? JSON.stringify(board) : null

  await env.DB.prepare(
    `INSERT INTO daily_scores (board_size, challenge_date, name, score, board, ending_roll, duration_ms, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(boardSize, date, cleanName, score, boardJson, endingRoll ?? null, durationMs ?? null, new Date().toISOString())
    .run()

  return new Response(null, { status: 204, headers: corsHeaders() })
}

async function handleDailyLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const boardSizeParam = url.searchParams.get('boardSize')
  const boardSize = boardSizeParam ? Number(boardSizeParam) : 20
  const date = url.searchParams.get('date') ?? ''

  if (!VALID_BOARD_SIZES.has(boardSize)) {
    return json({ error: 'Unknown boardSize.' }, 400)
  }
  if (!DATE_PATTERN.test(date)) {
    return json({ error: 'date (YYYY-MM-DD) is required.' }, 400)
  }

  // Score first, so a fast low score never outranks a slow high one. Then
  // time, with `duration_ms IS NULL` ahead of it: SQLite sorts nulls first in
  // ASC, which would put every untimed score from before this existed at the
  // top of its tie rather than behind. Submission time remains the last word.
  const { results } = await env.DB.prepare(
    `SELECT id, name, score, board, ending_roll, duration_ms FROM daily_scores
     WHERE board_size = ?1 AND challenge_date = ?2
     ORDER BY score DESC, duration_ms IS NULL ASC, duration_ms ASC, created_at ASC LIMIT 10`,
  )
    .bind(boardSize, date)
    .all<{ id: number; name: string; score: number; board: string | null; ending_roll: number | null; duration_ms: number | null }>()

  const entries = results.map(({ id, name, score, board, ending_roll, duration_ms }) => ({
    id,
    name,
    score,
    board: parseBoard(board),
    endingRoll: ending_roll,
    durationMs: duration_ms,
  }))
  return json({ boardSize, date, entries })
}

// Exported for its own tests: both the streak leaderboard and the nightly
// roll-up depend on it, and getting it wrong across a month or year boundary
// would quietly attribute a day's games to the wrong date.
export function yesterday(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

interface StreakSubmitBody {
  deviceId: string
  name: string
  streakCount: number
  lastPlayedDate: string
}

function isValidStreakSubmit(body: unknown): body is StreakSubmitBody {
  if (!body || typeof body !== 'object') return false
  const { deviceId, name, streakCount, lastPlayedDate } = body as Record<string, unknown>
  if (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId)) return false
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 8 || !NAME_PATTERN.test(trimmed)) return false
  if (typeof streakCount !== 'number' || !Number.isInteger(streakCount) || streakCount < 1) return false
  return typeof lastPlayedDate === 'string' && DATE_PATTERN.test(lastPlayedDate)
}

async function handleStreakSubmit(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidStreakSubmit(body)) {
    return json({ error: 'deviceId, name (1-8 letters/digits/spaces), streakCount (>=1), and lastPlayedDate (YYYY-MM-DD) are required.' }, 400)
  }

  const { deviceId, name, streakCount, lastPlayedDate } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  const cleanName = name.trim().toUpperCase()

  await env.DB.prepare(
    `INSERT INTO streaks (device_id, name, streak_count, last_played_date, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (device_id) DO UPDATE SET name = ?2, streak_count = ?3, last_played_date = ?4, updated_at = ?5`,
  )
    .bind(deviceId, cleanName, streakCount, lastPlayedDate, new Date().toISOString())
    .run()

  return new Response(null, { status: 204, headers: corsHeaders() })
}

async function handleStreakLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const today = url.searchParams.get('today') ?? ''

  if (!DATE_PATTERN.test(today)) {
    return json({ error: 'today (YYYY-MM-DD) is required.' }, 400)
  }

  // A streak counts as still active if it was last played today or
  // yesterday, mirroring src/game/daily.ts's isStreakActive exactly — a
  // streak that lapsed further back than that just falls out of the
  // ranking on its own with no separate cleanup step needed.
  const { results } = await env.DB.prepare(
    `SELECT name, streak_count FROM streaks
     WHERE last_played_date = ?1 OR last_played_date = ?2
     ORDER BY streak_count DESC LIMIT 10`,
  )
    .bind(today, yesterday(today))
    .all<{ name: string; streak_count: number }>()

  const entries = results.map(({ name, streak_count }) => ({ name, streakCount: streak_count }))
  return json({ today, entries })
}

// One row per completed game, win or lose, both modes — keyed by this
// device's local id (the same one streaks uses, never shown anywhere).
// Lets a per-device breakdown ("22 games today, 3 past halfway, better
// than yesterday's 1") be built later; the placements/scores tables can't
// answer that, since placements has no date and scores/daily_scores only
// capture qualifying top-10 saves. Name is optional and often absent — most
// games are logged before a name is ever chosen, which only happens on a
// qualifying score.
const MODE_PATTERN = /^(freeplay|daily)$/

interface GameLogBody {
  deviceId: string
  name: string | null
  date: string
  mode: string
  boardSize: number
  placedCount: number
}

function isValidGameLog(body: unknown): body is GameLogBody {
  if (!body || typeof body !== 'object') return false
  const { deviceId, name, date, mode, boardSize, placedCount } = body as Record<string, unknown>
  if (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId)) return false
  if (name !== null && typeof name !== 'string') return false
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return false
  if (typeof mode !== 'string' || !MODE_PATTERN.test(mode)) return false
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  return typeof placedCount === 'number' && Number.isInteger(placedCount) && placedCount >= 0 && placedCount <= boardSize
}

async function handleGameLog(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidGameLog(body)) {
    return json(
      { error: 'deviceId, date (YYYY-MM-DD), mode (freeplay|daily), boardSize, and placedCount (0..boardSize) are required.' },
      400,
    )
  }

  const { deviceId, name, date, mode, boardSize, placedCount } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  const cleanName = typeof name === 'string' && name.trim().length > 0 ? name.trim().toUpperCase().slice(0, 8) : null
  const loggedAt = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(deviceId, cleanName, date, mode, boardSize, placedCount, loggedAt)
    .run()

  // Same game, pushed to anyone watching the live feed. Awaited rather than
  // fired into waitUntil: nothing on the client blocks on this response (the
  // frontend's logGame discards it), so the few milliseconds cost nobody
  // anything, and in exchange the event is guaranteed to be in the feed
  // before we answer instead of racing the response. The catch keeps a feed
  // problem from undoing a game_log write that already succeeded — D1 is the
  // record that matters, the feed is ephemeral.
  await env.ACTIVITY.getByName(FEED_INSTANCE)
    .record({ deviceId, name: cleanName, mode, boardSize, placedCount, at: loggedAt })
    .catch(() => {})

  return new Response(null, { status: 204, headers: corsHeaders() })
}

// No 0/O or 1/I/L: the whole point is that someone reads this aloud across a
// room, or copies it off one screen onto another, without a character that
// looks like a different character.
const TRANSFER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const TRANSFER_CODE_LENGTH = 6
const TRANSFER_TTL_MS = 15 * 60 * 1000
// A saved game is a few kilobytes. This is a generous ceiling that still stops
// the endpoint being used as free general-purpose storage.
const MAX_TRANSFER_PAYLOAD_BYTES = 256 * 1024

const TRANSFER_CODE_PATTERN = new RegExp(`^[${TRANSFER_ALPHABET}]{${TRANSFER_CODE_LENGTH}}$`)

// crypto.getRandomValues rather than Math.random: this is the only thing
// standing between a stranger and someone's saved game for fifteen minutes.
// Rejection sampling keeps every character equally likely, which a plain
// modulo would not.
function generateTransferCode(): string {
  const bytes = new Uint8Array(TRANSFER_CODE_LENGTH * 2)
  let code = ''

  while (code.length < TRANSFER_CODE_LENGTH) {
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (code.length === TRANSFER_CODE_LENGTH) break
      if (byte < 248) code += TRANSFER_ALPHABET[byte % TRANSFER_ALPHABET.length]
    }
  }

  return code
}

async function handleTransferCreate(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!body || typeof body !== 'object' || typeof (body as { payload?: unknown }).payload !== 'string') {
    return json({ error: 'payload (a string) is required.' }, 400)
  }

  const { payload } = body as { payload: string }
  if (payload.length === 0 || payload.length > MAX_TRANSFER_PAYLOAD_BYTES) {
    return json({ error: 'payload is empty or too large.' }, 400)
  }

  // No device id in a transfer: the whole point is that the receiving device
  // has none of this yet. Address is the only key available.
  if (!(await allowWrite(request, env))) return tooManyRequests()

  const now = Date.now()
  const code = generateTransferCode()

  // Expired rows are cleared out here rather than on a schedule. Transfers are
  // rare and short-lived, so a sweep on write keeps the table small without
  // needing its own cron.
  await env.DB.prepare('DELETE FROM transfers WHERE expires_at < ?1').bind(new Date(now).toISOString()).run()

  await env.DB.prepare('INSERT INTO transfers (code, payload, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(code, payload, new Date(now).toISOString(), new Date(now + TRANSFER_TTL_MS).toISOString())
    .run()

  return json({ code, expiresAt: new Date(now + TRANSFER_TTL_MS).toISOString() })
}

async function handleTransferClaim(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const rawCode = (body as { code?: unknown })?.code
  if (typeof rawCode !== 'string') {
    return json({ error: 'code is required.' }, 400)
  }

  // Typed by a person, so accept the shape they'd naturally produce.
  const code = rawCode.trim().toUpperCase()
  if (!TRANSFER_CODE_PATTERN.test(code)) {
    return json({ error: 'That code does not look right.' }, 400)
  }

  // Also the one endpoint where a limit does real security work rather than
  // curbing nuisance: it caps how fast codes can be guessed.
  if (!(await allowWrite(request, env))) return tooManyRequests()

  const now = new Date().toISOString()
  const row = await env.DB.prepare('SELECT payload, expires_at, claimed_at FROM transfers WHERE code = ?1')
    .bind(code)
    .first<{ payload: string; expires_at: string; claimed_at: string | null }>()

  // One message for "no such code", "already used" and "too old". Telling the
  // difference would confirm to a guesser that a code exists.
  if (!row || row.claimed_at !== null || row.expires_at < now) {
    return json({ error: 'That code has expired or has already been used.' }, 404)
  }

  // Marking claimed is conditional on it still being unclaimed, so two devices
  // racing the same code can only ever have one of them win.
  const claim = await env.DB.prepare('UPDATE transfers SET claimed_at = ?1 WHERE code = ?2 AND claimed_at IS NULL')
    .bind(now, code)
    .run()

  if (!claim.meta.changes) {
    return json({ error: 'That code has expired or has already been used.' }, 404)
  }

  return json({ payload: row.payload })
}

// Lets the sending device notice the move landed, so it can offer to clear
// itself. Deliberately returns nothing but a boolean.
async function handleTransferStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = (url.searchParams.get('code') ?? '').trim().toUpperCase()

  if (!TRANSFER_CODE_PATTERN.test(code)) {
    return json({ error: 'code is required.' }, 400)
  }

  const row = await env.DB.prepare('SELECT claimed_at FROM transfers WHERE code = ?1').bind(code).first<{ claimed_at: string | null }>()

  return json({ claimed: row?.claimed_at != null })
}

// A push subscription is issued by the browser's own push service, so the
// endpoint host is not ours to predict. It must at least be https and a real
// URL, so a malformed one cannot be stored and retried every morning forever.
const MAX_ENDPOINT_LENGTH = 1024
const MAX_KEY_LENGTH = 256

function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) return false
  try {
    return new URL(endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

function isValidKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_KEY_LENGTH
}

async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }

  const { endpoint, p256dh, auth, deviceId } = (body ?? {}) as Record<string, unknown>

  if (!isValidEndpoint(endpoint)) {
    return json({ error: 'A https endpoint is required.' }, 400)
  }
  if (!isValidKey(p256dh) || !isValidKey(auth)) {
    return json({ error: 'p256dh and auth are required.' }, 400)
  }
  if (deviceId != null && (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId))) {
    return json({ error: 'deviceId is not valid.' }, 400)
  }

  if (!(await allowWrite(request, env, typeof deviceId === 'string' ? deviceId : null))) {
    return json({ error: 'Too many requests.' }, 429)
  }

  // Re-subscribing replaces the row. created_at is deliberately not reset, so
  // it keeps reading as when this browser first opted in.
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, device_id = ?4`,
  )
    .bind(endpoint, p256dh, auth, typeof deviceId === 'string' ? deviceId : null, new Date().toISOString())
    .run()

  return new Response(null, { status: 204, headers: corsHeaders() })
}

async function handlePushUnsubscribe(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }

  const { endpoint } = (body ?? {}) as Record<string, unknown>

  if (!isValidEndpoint(endpoint)) {
    return json({ error: 'A https endpoint is required.' }, 400)
  }

  if (!(await allowWrite(request, env))) {
    return json({ error: 'Too many requests.' }, 429)
  }

  // No 404 for an endpoint that was never stored: turning something off that
  // is already off has succeeded, and saying otherwise would leave the app
  // showing an error for a state the player wanted anyway.
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(endpoint).run()

  return new Response(null, { status: 204, headers: corsHeaders() })
}

// Ten past midnight UTC: the day being summarised has ended and every game
// for it is in.
export const ROLLUP_CRON = '10 0 * * *'
// 08:00 UTC, which is 9am British summer time and 8am in winter. Early enough
// to catch the morning, late enough not to wake anyone.
export const REMINDER_CRON = '0 8 * * *'

export interface ReminderRun {
  sent: number
  // Already played today's daily, so left alone.
  skipped: number
  // Subscriptions the push service said are gone for good, now deleted.
  removed: number
  // Refused for some other reason; the row stays and tomorrow tries again.
  failed: number
  // Sends not attempted because the run hit its own ceiling.
  deferred: number
}

// The Workers free plan allows 50 subrequests per invocation, and each send is
// one. This leaves headroom for the queries around them. Well above the number
// of people who will ever have this turned on, but a silent truncation would
// be indistinguishable from everyone being reached, so anything skipped is
// counted and logged.
const MAX_SENDS_PER_RUN = 40

// Sends the one notification a day. Everything it needs is passed in rather
// than read from a clock, so a test can run a specific morning.
export async function sendDailyReminders(env: Env, today: string, nowMs: number): Promise<ReminderRun> {
  const run: ReminderRun = { sent: 0, skipped: 0, removed: 0, failed: 0, deferred: 0 }

  const subscriptions = await env.DB.prepare('SELECT endpoint, device_id FROM push_subscriptions')
    .all<{ endpoint: string; device_id: string | null }>()

  if (subscriptions.results.length === 0) return run

  // An early bird who has already done today's challenge does not need
  // telling it exists. Free play does not count: the daily is the thing being
  // reminded about, and someone can play a dozen free games without touching it.
  const alreadyPlayed = await env.DB.prepare(
    "SELECT DISTINCT device_id FROM game_log WHERE date = ?1 AND mode = 'daily'",
  )
    .bind(today)
    .all<{ device_id: string }>()
  const played = new Set(alreadyPlayed.results.map(row => row.device_id))

  const due = subscriptions.results.filter(row => {
    if (row.device_id && played.has(row.device_id)) {
      run.skipped += 1
      return false
    }
    return true
  })

  const sending = due.slice(0, MAX_SENDS_PER_RUN)
  run.deferred = due.length - sending.length

  const keys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
  const statuses = await Promise.all(sending.map(row => sendPush(row.endpoint, keys, nowMs)))

  const gone: string[] = []
  const delivered: string[] = []

  statuses.forEach((status, index) => {
    const { endpoint } = sending[index]
    if (isSubscriptionGone(status)) {
      gone.push(endpoint)
      run.removed += 1
    } else if (status >= 200 && status < 300) {
      delivered.push(endpoint)
      run.sent += 1
    } else {
      run.failed += 1
    }
  })

  const writes: D1PreparedStatement[] = []
  if (gone.length > 0) {
    writes.push(
      env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint IN (${gone.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...gone),
    )
  }
  if (delivered.length > 0) {
    const sentAt = new Date(nowMs).toISOString()
    writes.push(
      env.DB.prepare(
        `UPDATE push_subscriptions SET last_sent_at = ?1 WHERE endpoint IN (${delivered.map((_, i) => `?${i + 2}`).join(', ')})`,
      ).bind(sentAt, ...delivered),
    )
  }
  if (writes.length > 0) await env.DB.batch(writes)

  return run
}

export interface DailySummary {
  date: string
  games: number
  players: number
  busiestName: string | null
  busiestGames: number | null
  bestName: string | null
  bestScore: number | null
  bestBoardSize: number | null
}

// Rolls one finished day of game_log into a single daily_summary row. Names
// come from game_log where the client sent one and fall back to the streaks
// table otherwise, since most games are logged before a name is ever chosen —
// a device that has never saved one stays null and reads as "someone".
export async function rollUpDay(env: Env, date: string, now: string): Promise<DailySummary> {
  const totals = await env.DB.prepare('SELECT COUNT(*) as games, COUNT(DISTINCT device_id) as players FROM game_log WHERE date = ?1')
    .bind(date)
    .first<{ games: number; players: number }>()

  const games = totals?.games ?? 0
  const players = totals?.players ?? 0

  // A day nobody played still gets a row, so the app can say so plainly
  // rather than showing an indefinite "nothing here yet".
  const busiest =
    games === 0
      ? null
      : await env.DB.prepare(
          `SELECT COALESCE(gl.name, s.name) as name, COUNT(*) as games
           FROM game_log gl LEFT JOIN streaks s ON s.device_id = gl.device_id
           WHERE gl.date = ?1
           GROUP BY gl.device_id
           ORDER BY games DESC LIMIT 1`,
        )
          .bind(date)
          .first<{ name: string | null; games: number }>()

  // Ranked by share of the board filled, not raw count — board sizes vary
  // from 10 to 30, so 30 placed on a 30-slot daily and 17 on a 20-slot free
  // play are not the same achievement and raw count would always favour the
  // bigger board.
  const best =
    games === 0
      ? null
      : await env.DB.prepare(
          `SELECT COALESCE(gl.name, s.name) as name, gl.placed_count, gl.board_size
           FROM game_log gl LEFT JOIN streaks s ON s.device_id = gl.device_id
           WHERE gl.date = ?1
           ORDER BY (CAST(gl.placed_count AS REAL) / gl.board_size) DESC, gl.placed_count DESC
           LIMIT 1`,
        )
          .bind(date)
          .first<{ name: string | null; placed_count: number; board_size: number }>()

  const summary: DailySummary = {
    date,
    games,
    players,
    busiestName: busiest?.name ?? null,
    busiestGames: busiest?.games ?? null,
    bestName: best?.name ?? null,
    bestScore: best?.placed_count ?? null,
    bestBoardSize: best?.board_size ?? null,
  }

  await env.DB.prepare(
    `INSERT INTO daily_summary (date, games, players, busiest_name, busiest_games, best_name, best_score, best_board_size, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT (date) DO UPDATE SET
       games = ?2, players = ?3, busiest_name = ?4, busiest_games = ?5,
       best_name = ?6, best_score = ?7, best_board_size = ?8, created_at = ?9`,
  )
    .bind(
      date,
      games,
      players,
      summary.busiestName,
      summary.busiestGames,
      summary.bestName,
      summary.bestScore,
      summary.bestBoardSize,
      now,
    )
    .run()

  return summary
}

// The app asks with its own idea of today, the same way the streak
// leaderboard does, so a player just past midnight in their timezone doesn't
// get handed a recap they'd read as the wrong day.
async function handleYesterdayRecap(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const today = url.searchParams.get('today') ?? ''

  if (!DATE_PATTERN.test(today)) {
    return json({ error: 'today (YYYY-MM-DD) is required.' }, 400)
  }

  const date = yesterday(today)
  const row = await env.DB.prepare(
    `SELECT date, games, players, busiest_name, busiest_games, best_name, best_score, best_board_size
     FROM daily_summary WHERE date = ?1`,
  )
    .bind(date)
    .first<{
      date: string
      games: number
      players: number
      busiest_name: string | null
      busiest_games: number | null
      best_name: string | null
      best_score: number | null
      best_board_size: number | null
    }>()

  if (!row) {
    return json({ date, summary: null })
  }

  const summary: DailySummary = {
    date: row.date,
    games: row.games,
    players: row.players,
    busiestName: row.busiest_name,
    busiestGames: row.busiest_games,
    bestName: row.best_name,
    bestScore: row.best_score,
    bestBoardSize: row.best_board_size,
  }

  return json({ date, summary })
}

export interface FeedReaction {
  emoji: string
  count: number
}

export interface FeedEvent {
  id: number
  name: string | null
  mode: string
  boardSize: number
  placedCount: number
  at: string
  reactions: FeedReaction[]
  // Whether the viewer of this particular snapshot reacted, and with what.
  // Per-viewer, which is why snapshots are built per socket rather than once.
  myReaction: string | null
}

export interface FeedSnapshot {
  events: FeedEvent[]
  playing: number
}

// What goes in, as opposed to what comes out: no id yet, and no reactions,
// since neither exists until the run has been stored.
export interface FeedEventInput {
  deviceId: string
  name: string | null
  mode: string
  boardSize: number
  placedCount: number
  at: string
}

// The board covers a rolling day, so a reaction outlives the session it was
// left in. A count-based window turned over in about three hours at this
// group's rate, which made reacting largely pointless.
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000

// Nothing should reach this in normal use; it only stops a runaway from
// growing the object without bound.
const MAX_FEED_EVENTS = 500

// At most this many runs each, so one long session can't push everyone else
// off the board entirely.
const RUNS_PER_PERSON = 3

// Deliberately small and fixed. Free text would need moderating, and this
// covers what actually happens in this game: well played, on fire, brutal,
// and funny-bad.
export const REACTION_EMOJI = ['\u{1F44F}', '\u{1F525}', '\u{1F631}', '\u{1F602}']

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
}

// A single shared instance ("the group") rather than one per player. That's
// normally the Durable Object anti-pattern, but the coordination atom here
// genuinely is the whole group: everyone reads the same board and the same
// live count, and there is exactly one of those. At this app's volume (a few
// hundred games a day across a handful of people) there's no contention to
// shard away from.
const FEED_INSTANCE = 'group'

interface SocketAttachment {
  deviceId: string | null
}

export class ActivityFeed extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Schema setup only — blockConcurrencyWhile here runs once per wake, and
    // must never wrap request work or it serializes the whole object.
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT,
          name TEXT,
          mode TEXT NOT NULL,
          board_size INTEGER NOT NULL,
          placed_count INTEGER NOT NULL,
          at TEXT NOT NULL
        )
      `)

      // Objects created before device_id existed keep their rows rather than
      // having the board dropped from under them. Any that predate it group as
      // their own person until they age out of the window on their own.
      try {
        this.ctx.storage.sql.exec('ALTER TABLE events ADD COLUMN device_id TEXT')
      } catch {
        // Already there.
      }

      // One row per person per event, enforced by the key rather than by
      // trusting the caller not to send twice.
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS reactions (
          event_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          emoji TEXT NOT NULL,
          PRIMARY KEY (event_id, device_id)
        )
      `)
    })
  }

  // Called over RPC when a game is logged. Storage first, then push — a
  // client that misses the broadcast still gets the event in its next
  // snapshot, but an event that was only ever broadcast would be lost the
  // moment this object hibernates.
  async record(event: FeedEventInput): Promise<void> {
    this.ctx.storage.sql.exec(
      'INSERT INTO events (device_id, name, mode, board_size, placed_count, at) VALUES (?, ?, ?, ?, ?, ?)',
      event.deviceId,
      event.name,
      event.mode,
      event.boardSize,
      event.placedCount,
      event.at,
    )
    this.prune(Date.parse(event.at))
    this.broadcast()
  }

  private prune(nowMs: number): void {
    const cutoff = new Date(nowMs - FEED_WINDOW_MS).toISOString()
    this.ctx.storage.sql.exec('DELETE FROM events WHERE at < ?', cutoff)
    this.ctx.storage.sql.exec('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT ?)', MAX_FEED_EVENTS)
    // Reactions belong to their run; when it goes, they go with it.
    this.ctx.storage.sql.exec('DELETE FROM reactions WHERE event_id NOT IN (SELECT id FROM events)')
  }

  async react(deviceId: string, eventId: number, emoji: string | null): Promise<void> {
    if (emoji === null) {
      this.ctx.storage.sql.exec('DELETE FROM reactions WHERE event_id = ? AND device_id = ?', eventId, deviceId)
    } else {
      // One each: reacting again with something else replaces, rather than
      // letting one person stack every emoji onto the same run.
      this.ctx.storage.sql.exec(
        `INSERT INTO reactions (event_id, device_id, emoji) VALUES (?, ?, ?)
         ON CONFLICT (event_id, device_id) DO UPDATE SET emoji = ?3`,
        eventId,
        deviceId,
        emoji,
      )
    }
    this.broadcast()
  }

  async snapshot(deviceId: string | null): Promise<FeedSnapshot> {
    return this.buildSnapshot(deviceId)
  }

  private buildSnapshot(viewerDeviceId: string | null, excluding?: WebSocket): FeedSnapshot {
    // Ranked by share of the board filled rather than raw count: board sizes
    // run from 10 to 30, so 30 of 30 is a better run than 18 of 20 even though
    // the raw numbers say otherwise.
    const rows = this.ctx.storage.sql
      .exec<{ id: number; name: string | null; mode: string; board_size: number; placed_count: number; at: string }>(
        // Grouped by name first, device second. Name is what a reader actually
        // sees, so grouping by it is what makes "three each" true on screen —
        // and it keeps one person as one person across a Move my game, where
        // the device id deliberately changes. Device id only decides it for
        // someone who has never saved a name, and the row id is a last resort
        // for rows written before device ids were stored at all.
        `SELECT id, name, mode, board_size, placed_count, at FROM (
           SELECT *, ROW_NUMBER() OVER (
             PARTITION BY COALESCE(NULLIF(name, ''), 'device:' || device_id, 'row:' || CAST(id AS TEXT))
             ORDER BY CAST(placed_count AS REAL) / board_size DESC, placed_count DESC, id DESC
           ) AS person_rank
           FROM events
         )
         WHERE person_rank <= ?
         ORDER BY CAST(placed_count AS REAL) / board_size DESC, placed_count DESC, id DESC`,
        RUNS_PER_PERSON,
      )
      .toArray()

    const counts = this.ctx.storage.sql
      .exec<{ event_id: number; emoji: string; n: number }>(
        'SELECT event_id, emoji, COUNT(*) AS n FROM reactions GROUP BY event_id, emoji',
      )
      .toArray()

    const mine = new Map<number, string>()
    if (viewerDeviceId !== null) {
      for (const row of this.ctx.storage.sql
        .exec<{ event_id: number; emoji: string }>('SELECT event_id, emoji FROM reactions WHERE device_id = ?', viewerDeviceId)
        .toArray()) {
        mine.set(row.event_id, row.emoji)
      }
    }

    return {
      events: rows.map(row => ({
        id: row.id,
        name: row.name,
        mode: row.mode,
        boardSize: row.board_size,
        placedCount: row.placed_count,
        at: row.at,
        // Kept in a fixed order so the chips don't reshuffle as counts change.
        reactions: REACTION_EMOJI.map(emoji => ({
          emoji,
          count: counts.find(count => count.event_id === row.id && count.emoji === emoji)?.n ?? 0,
        })).filter(reaction => reaction.count > 0),
        myReaction: mine.get(row.id) ?? null,
      })),
      playing: this.ctx.getWebSockets().filter(socket => socket !== excluding).length,
    }
  }

  private viewerOf(socket: WebSocket): string | null {
    try {
      return (socket.deserializeAttachment() as SocketAttachment | null)?.deviceId ?? null
    } catch {
      return null
    }
  }

  // `excluding` exists for the disconnect case: getWebSockets() still lists a
  // socket while its close handler is running, so counting naively there would
  // report one player too many to everyone left.
  //
  // Built per socket rather than once, because whether a reaction is yours
  // differs by viewer, and sending everyone's device ids so each client could
  // work it out itself would leak them across the group.
  private broadcast(excluding?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === excluding) continue
      try {
        socket.send(JSON.stringify(this.buildSnapshot(this.viewerOf(socket), excluding)))
      } catch {
        // Already closing — its close handler will run and re-broadcast.
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (!isWebSocketUpgrade(request)) {
      return new Response('Expected a websocket upgrade.', { status: 426 })
    }

    const deviceId = new URL(request.url).searchParams.get('deviceId')
    const [client, server] = Object.values(new WebSocketPair())
    // acceptWebSocket, not server.accept() — this is what lets the object be
    // evicted from memory while connections stay open, so idle players don't
    // accrue duration charges.
    this.ctx.acceptWebSocket(server)
    // In-memory state is lost on hibernation, so who this socket belongs to
    // has to be attached to the socket itself rather than held in a field.
    server.serializeAttachment({ deviceId } satisfies SocketAttachment)
    // Sends to the newcomer and everyone already here, so the live count
    // updates for all of them in one step.
    this.broadcast()

    return new Response(null, { status: 101, webSocket: client })
  }

  // Clients only listen; anything inbound is treated as a request to resync.
  override async webSocketMessage(ws: WebSocket): Promise<void> {
    ws.send(JSON.stringify(this.buildSnapshot(this.viewerOf(ws))))
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // 1006 is "abnormal closure" and is never valid to send back.
    ws.close(code === 1006 ? 1000 : code, reason)
    this.broadcast(ws)
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcast(ws)
  }
}

// Two ways in: a WebSocket for live updates, or a plain GET that returns the
// same snapshot once. The fallback matters because a network or browser that
// blocks WebSockets would otherwise leave the panel empty forever rather than
// merely un-live.
async function handleActivity(request: Request, env: Env): Promise<Response> {
  const stub = env.ACTIVITY.getByName(FEED_INSTANCE)

  // The upgrade carries ?deviceId through to the object untouched, which is
  // how it knows whose reactions to mark as yours on this connection.
  if (isWebSocketUpgrade(request)) {
    return stub.fetch(request)
  }

  const deviceId = new URL(request.url).searchParams.get('deviceId')
  return json(await stub.snapshot(deviceId !== null && DEVICE_ID_PATTERN.test(deviceId) ? deviceId : null))
}

interface ReactionBody {
  deviceId: string
  eventId: number
  emoji: string | null
}

function isValidReaction(body: unknown): body is ReactionBody {
  if (!body || typeof body !== 'object') return false
  const { deviceId, eventId, emoji } = body as Record<string, unknown>
  if (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId)) return false
  if (typeof eventId !== 'number' || !Number.isInteger(eventId) || eventId < 1) return false
  // null clears it; anything else has to be one of the four on offer, so the
  // feed can't be used to post arbitrary text.
  return emoji === null || (typeof emoji === 'string' && REACTION_EMOJI.includes(emoji))
}

async function handleReact(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  if (!isValidReaction(body)) {
    return json({ error: 'deviceId, eventId, and emoji (one of the allowed set, or null) are required.' }, 400)
  }

  const { deviceId, eventId, emoji } = body
  if (!(await allowWrite(request, env, deviceId))) return tooManyRequests()

  await env.ACTIVITY.getByName(FEED_INSTANCE).react(deviceId, eventId, emoji)

  return new Response(null, { status: 204, headers: corsHeaders() })
}

// Writes only. Reads are cheap, carry no risk of polluting anything, and
// gating them would put a Durable Object round trip in front of every poll.
//
// Sixty a minute per person against a measured peak of about twenty: a game
// makes three or four writes and the busiest real minute in the log is five
// games. So this is invisible in normal play and stops a script immediately.
const WRITES_PER_WINDOW = 60
const RATE_WINDOW_MS = 60_000

interface RateWindow {
  startedAt: number
  count: number
}

const WINDOW_KEY = 'window'

// One instance per key, so two people are never queued behind each other.
// A single shared limiter would serialise every write in the app through one
// object, which is the Durable Object anti-pattern and would show up as
// latency long before it showed up as protection.
export class RateLimiter extends DurableObject<Env> {
  // Fixed window rather than sliding: simpler, and the worst case is that
  // someone straddling a boundary gets up to twice the allowance briefly.
  // For a backstop against scripted abuse that is a fine trade.
  async consume(nowMs: number): Promise<boolean> {
    const stored = await this.ctx.storage.get<RateWindow>(WINDOW_KEY)
    const window: RateWindow =
      stored && nowMs - stored.startedAt < RATE_WINDOW_MS ? { ...stored, count: stored.count + 1 } : { startedAt: nowMs, count: 1 }

    await this.ctx.storage.put(WINDOW_KEY, window)
    return window.count <= WRITES_PER_WINDOW
  }
}

// Keyed on the player rather than the address wherever possible. A household
// shares one public address, so limiting on that alone would count four people
// on the same sofa as one — which is also why Cloudflare's own docs advise
// against IP as a key. The address is only a fallback for the couple of writes
// that legitimately have no device behind them.
export async function allowWrite(request: Request, env: Env, deviceId?: string | null): Promise<boolean> {
  const key = deviceId ? `device:${deviceId}` : `ip:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`

  try {
    return await env.RATE_LIMITER.getByName(key).consume(Date.now())
  } catch {
    // Fails open: a problem in the limiter must never take writes down with
    // it. What it guards against is nuisance, not danger.
    return true
  }
}

function tooManyRequests(): Response {
  return json({ error: 'Too many requests. Give it a moment and try again.' }, 429)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/placements') {
      return handlePost(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/placements/summary') {
      return handleSummary(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/scores/check') {
      return handleScoreCheck(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/scores') {
      return handleScoreSubmit(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/scores/leaderboard') {
      return handleLeaderboard(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/daily-scores/check') {
      return handleDailyScoreCheck(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/daily-scores') {
      return handleDailyScoreSubmit(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/daily-scores/leaderboard') {
      return handleDailyLeaderboard(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/streaks') {
      return handleStreakSubmit(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/streaks/leaderboard') {
      return handleStreakLeaderboard(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/games') {
      return handleGameLog(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/community/yesterday') {
      return handleYesterdayRecap(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/activity') {
      return handleActivity(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/activity/react') {
      return handleReact(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/transfer') {
      return handleTransferCreate(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/transfer/claim') {
      return handleTransferClaim(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/push/subscribe') {
      return handlePushSubscribe(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/push/unsubscribe') {
      return handlePushUnsubscribe(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/transfer/status') {
      return handleTransferStatus(request, env)
    }

    return json({ error: 'Not found.' }, 404)
  },

  // Two schedules arrive here and are told apart by controller.cron. Both
  // strings have to match wrangler.toml exactly or the wrong branch runs, so
  // test/cron.test.ts reads the file and asserts they do.
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    // controller.scheduledTime rather than Date.now(): it's the instant this
    // run was *meant* to fire. A delayed or retried invocation then still
    // works on the day it was scheduled for, instead of whichever day it
    // happened to actually run on.
    const firedAt = new Date(controller.scheduledTime).toISOString()

    if (controller.cron === REMINDER_CRON) {
      const run = await sendDailyReminders(env, firedAt.slice(0, 10), controller.scheduledTime)
      console.log(`daily reminder ${JSON.stringify(run)}`)
      return
    }

    // The roll-up is also the fallback. It is an upsert keyed on date, so an
    // unrecognised schedule landing here repeats work rather than corrupting
    // anything, which is the safer way round to be wrong.
    await rollUpDay(env, yesterday(firedAt.slice(0, 10)), firedAt)
  },
}
