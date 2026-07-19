export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

function hashStringToSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return hash
}

// mulberry32 — small, fast, deterministic PRNG. Same seed always produces
// the same sequence, which is the whole point: everyone gets today's exact
// same rolls in the exact same order.
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDailyRng(dateString: string): () => number {
  return mulberry32(hashStringToSeed(dateString))
}

// Cycles through a spread of difficulties rather than always being the same
// size as free play — 20 is deliberately excluded since that's already
// free play's fixed size, and a daily should always read as distinct.
export const DAILY_BOARD_SIZES = [10, 15, 25, 30]

export function getDailyBoardSize(dateString: string): number {
  // Hashed with a distinct prefix from createDailyRng's seed so the board
  // size and the roll sequence aren't derived from the exact same number.
  const hash = hashStringToSeed(`size:${dateString}`)
  const index = Math.abs(hash) % DAILY_BOARD_SIZES.length
  return DAILY_BOARD_SIZES[index]
}

export interface StreakData {
  count: number
  lastPlayedDate: string | null
  bestStreak: number
}

export function createEmptyStreak(): StreakData {
  return { count: 0, lastPlayedDate: null, bestStreak: 0 }
}

export function isStreakActive(streak: StreakData, today: string): boolean {
  if (!streak.lastPlayedDate) return false
  return streak.lastPlayedDate === today || streak.lastPlayedDate === addDays(today, -1)
}

export function recordDailyStreak(streak: StreakData, today: string): StreakData {
  if (streak.lastPlayedDate === today) return streak
  const wasYesterday = streak.lastPlayedDate === addDays(today, -1)
  const count = wasYesterday ? streak.count + 1 : 1
  return { count, lastPlayedDate: today, bestStreak: Math.max(streak.bestStreak, count) }
}
