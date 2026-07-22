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

function isValidBatch(body: unknown): body is { boardSize: number; placements: PlacementEntry[] } {
  if (!body || typeof body !== 'object') return false
  const { boardSize, placements } = body as Record<string, unknown>
  if (typeof boardSize !== 'number' || !VALID_BOARD_SIZES.has(boardSize)) return false
  if (!Array.isArray(placements) || placements.length === 0 || placements.length > MAX_PLACEMENTS_PER_REQUEST) return false
  return placements.every(entry => isValidEntry(entry, boardSize))
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

  const { boardSize, placements } = body
  const statement = env.DB.prepare(
    `INSERT INTO placements (board_size, position, value_bucket, count)
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (board_size, position, value_bucket)
     DO UPDATE SET count = count + 1`,
  )
  await env.DB.batch(placements.map(entry => statement.bind(boardSize, entry.position, entry.valueBucket)))

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

    return json({ error: 'Not found.' }, 404)
  },
}
