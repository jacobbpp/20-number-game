export interface Env {
  DB: D1Database
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
  const { boardSize, name, score, board, endingRoll } = body as Record<string, unknown>
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

  const { boardSize, name, score, board, endingRoll } = body
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
}

function isValidDailyScoreSubmit(body: unknown): body is DailyScoreSubmitBody {
  if (!body || typeof body !== 'object') return false
  const { boardSize, date, name, score, board, endingRoll } = body as Record<string, unknown>
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return false
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > boardSize) return false
  if (typeof name !== 'string') return false
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 8 || !NAME_PATTERN.test(trimmed)) return false
  if (!(board === undefined || board === null || isValidBoard(board, boardSize))) return false
  return endingRoll === undefined || isValidEndingRoll(endingRoll)
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

  const { boardSize, date, name, score, board, endingRoll } = body
  const cleanName = name.trim().toUpperCase()
  const boardJson = Array.isArray(board) ? JSON.stringify(board) : null

  await env.DB.prepare(
    'INSERT INTO daily_scores (board_size, challenge_date, name, score, board, ending_roll, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(boardSize, date, cleanName, score, boardJson, endingRoll ?? null, new Date().toISOString())
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

  const { results } = await env.DB.prepare(
    `SELECT id, name, score, board, ending_roll FROM daily_scores
     WHERE board_size = ?1 AND challenge_date = ?2
     ORDER BY score DESC, created_at ASC LIMIT 10`,
  )
    .bind(boardSize, date)
    .all<{ id: number; name: string; score: number; board: string | null; ending_roll: number | null }>()

  const entries = results.map(({ id, name, score, board, ending_roll }) => ({ id, name, score, board: parseBoard(board), endingRoll: ending_roll }))
  return json({ boardSize, date, entries })
}

function yesterday(date: string): string {
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
  const cleanName = typeof name === 'string' && name.trim().length > 0 ? name.trim().toUpperCase().slice(0, 8) : null

  await env.DB.prepare(
    `INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(deviceId, cleanName, date, mode, boardSize, placedCount, new Date().toISOString())
    .run()

  return new Response(null, { status: 204, headers: corsHeaders() })
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

    return json({ error: 'Not found.' }, 404)
  },
}
