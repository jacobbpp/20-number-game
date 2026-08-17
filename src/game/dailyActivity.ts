import { addDays } from './daily'
import type { LeaderboardWindow } from './leaderboardActivity'
import { BOARD_SIZE } from './types'

export interface LeaderboardHitCounts {
  day: number
  week: number
  month: number
  all: number
}

// One entry per calendar date, not per game — a score histogram (index i =
// count of games that placed i+1) is enough to answer "how many games
// today", "how many scored under N", and "what was the best that day"
// without needing to remember every individual game, and it stays small
// even kept indefinitely, unlike a raw log that grows one row per game.
export interface DailyActivityEntry {
  date: string
  scoreHistogram: number[]
  leaderboardHits: LeaderboardHitCounts
}

export type DailyActivityLog = Record<string, DailyActivityEntry>

function createEmptyEntry(date: string): DailyActivityEntry {
  return {
    date,
    scoreHistogram: Array(BOARD_SIZE).fill(0),
    leaderboardHits: { day: 0, week: 0, month: 0, all: 0 },
  }
}

export function recordGameResult(log: DailyActivityLog, date: string, score: number, windows: LeaderboardWindow[]): DailyActivityLog {
  const existing = log[date] ?? createEmptyEntry(date)
  const scoreHistogram = [...existing.scoreHistogram]
  const index = Math.min(BOARD_SIZE, Math.max(1, score)) - 1
  scoreHistogram[index] = (scoreHistogram[index] ?? 0) + 1

  const leaderboardHits: LeaderboardHitCounts = {
    day: existing.leaderboardHits.day + (windows.includes('day') ? 1 : 0),
    week: existing.leaderboardHits.week + (windows.includes('week') ? 1 : 0),
    month: existing.leaderboardHits.month + (windows.includes('month') ? 1 : 0),
    all: existing.leaderboardHits.all + (windows.includes('all') ? 1 : 0),
  }

  return { ...log, [date]: { date, scoreHistogram, leaderboardHits } }
}

export function gamesPlayed(entry: DailyActivityEntry | undefined): number {
  if (!entry) return 0
  return entry.scoreHistogram.reduce((sum, count) => sum + count, 0)
}

export function maxScore(entry: DailyActivityEntry | undefined): number | null {
  if (!entry) return null
  for (let i = entry.scoreHistogram.length - 1; i >= 0; i--) {
    if (entry.scoreHistogram[i] > 0) return i + 1
  }
  return null
}

// Counts games scoring strictly below the threshold — "under 10" means
// scores 1 through 9, i.e. histogram indices 0 through threshold - 2.
export function shortGamesCount(entry: DailyActivityEntry | undefined, threshold: number): number {
  if (!entry) return 0
  let count = 0
  for (let i = 0; i < threshold - 1 && i < entry.scoreHistogram.length; i++) {
    count += entry.scoreHistogram[i]
  }
  return count
}

export function busiestDay(log: DailyActivityLog): { date: string; games: number } | null {
  let best: { date: string; games: number } | null = null
  for (const entry of Object.values(log)) {
    const games = gamesPlayed(entry)
    if (games > 0 && (!best || games > best.games)) best = { date: entry.date, games }
  }
  return best
}

// The running personal-best value on every day it actually changed — the
// points a line chart of "best score over time" would plot. Skips days
// that didn't set a new record, so a long flat stretch isn't a run of
// identical points.
export function bestScoreTrend(log: DailyActivityLog): { date: string; score: number }[] {
  const dates = Object.keys(log).sort()
  const points: { date: string; score: number }[] = []
  let running = 0
  for (const date of dates) {
    const dayBest = maxScore(log[date])
    if (dayBest !== null && dayBest > running) {
      running = dayBest
      points.push({ date, score: running })
    }
  }
  return points
}


// A fixed-length, oldest-to-newest window ending today, zero-filled for any
// day with no games — the shape a calendar heatmap needs regardless of how
// sparse the underlying log is.
export function activityWindow(log: DailyActivityLog, today: string, days: number): { date: string; games: number }[] {
  const window: { date: string; games: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    window.push({ date, games: gamesPlayed(log[date]) })
  }
  return window
}

// Every score from one day, highest first. The histogram doesn't record the
// order games were played in, so this deliberately reads as a ranked list
// rather than pretending to be a timeline.
export function scoresForDay(entry: DailyActivityEntry | undefined): number[] {
  if (!entry) return []
  const scores: number[] = []
  for (let i = entry.scoreHistogram.length - 1; i >= 0; i--) {
    for (let n = 0; n < entry.scoreHistogram[i]; n++) scores.push(i + 1)
  }
  return scores
}

// Four filled steps plus an empty one. Discrete rather than a smooth fade:
// with a continuous alpha, a four-game day and a six-game day come out close
// enough to look identical, which defeats the point of a heatmap.
export const ACTIVITY_LEVELS = 4

export function activityLevel(games: number, busiest: number): number {
  if (games <= 0) return 0
  if (busiest <= 0) return 0
  // Rounded up, so any day that was played at all clears level 1 and never
  // renders as an untouched square.
  return Math.max(1, Math.min(ACTIVITY_LEVELS, Math.ceil((games / busiest) * ACTIVITY_LEVELS)))
}

// Monday-first column index. Parsed as UTC so the answer is a property of the
// calendar date itself and can't shift with the reader's timezone.
export function mondayFirstWeekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

export interface CalendarCell {
  // Null marks a leading blank, present only so the first real day lands in
  // its true weekday column.
  date: string | null
  games: number
}

export function calendarGrid(log: DailyActivityLog, today: string, days: number): CalendarCell[] {
  const window = activityWindow(log, today, days)
  if (window.length === 0) return []

  const padding = mondayFirstWeekday(window[0].date)
  return [...Array.from({ length: padding }, (): CalendarCell => ({ date: null, games: 0 })), ...window]
}

const WINDOW_LABELS: { key: keyof LeaderboardHitCounts; label: string }[] = [
  { key: 'day', label: 'day' },
  { key: 'week', label: 'week' },
  { key: 'month', label: 'month' },
  { key: 'all', label: 'all-time' },
]

// Reported per window rather than as one total. The four counters are
// independent — a single strong game can appear in several — so summing them
// would overstate how many games got somewhere, and there's no way to recover
// the true union from counts alone.
export function leaderboardHitsForDay(entry: DailyActivityEntry | undefined): { label: string; count: number }[] {
  if (!entry) return []
  return WINDOW_LABELS.map(({ key, label }) => ({ label, count: entry.leaderboardHits[key] })).filter(hit => hit.count > 0)
}

function averageScoreOverRange(log: DailyActivityLog, today: string, daysAgoStart: number, daysAgoEnd: number): number | null {
  let totalScore = 0
  let totalGames = 0
  for (let i = daysAgoStart; i <= daysAgoEnd; i++) {
    const entry = log[addDays(today, -i)]
    if (!entry) continue
    entry.scoreHistogram.forEach((count, index) => {
      totalScore += count * (index + 1)
      totalGames += count
    })
  }
  return totalGames > 0 ? totalScore / totalGames : null
}

// Rolling 7-day windows rather than calendar weeks, so this never depends
// on which day the week is considered to start.
export function weeklyAverageDelta(log: DailyActivityLog, today: string): { thisWeek: number; lastWeek: number } | null {
  const thisWeek = averageScoreOverRange(log, today, 0, 6)
  const lastWeek = averageScoreOverRange(log, today, 7, 13)
  if (thisWeek === null || lastWeek === null) return null
  return { thisWeek, lastWeek }
}

export function todayReach(log: DailyActivityLog, today: string): { gamesToday: number; hits: LeaderboardHitCounts } {
  const entry = log[today]
  return { gamesToday: gamesPlayed(entry), hits: entry?.leaderboardHits ?? { day: 0, week: 0, month: 0, all: 0 } }
}

// Whether any free-play game, on any day, has ever qualified for at least
// one leaderboard window — a hit on "day" doesn't imply a hit on "all" (the
// bars are independent), so every window on every day needs checking.
export function hasEverQualifiedForLeaderboard(log: DailyActivityLog): boolean {
  return Object.values(log).some(entry => {
    const { day, week, month, all } = entry.leaderboardHits
    return day > 0 || week > 0 || month > 0 || all > 0
  })
}
