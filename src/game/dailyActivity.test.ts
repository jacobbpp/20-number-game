import { describe, expect, it } from 'vitest'
import {
  activityWindow,
  bestScoreTrend,
  busiestDay,
  closestCalls,
  gamesPlayed,
  maxScore,
  recordGameResult,
  shortGamesCount,
  todayReach,
  weeklyAverageDelta,
  type DailyActivityLog,
} from './dailyActivity'

const D1 = '2026-07-01'
const D2 = '2026-07-02'
const D3 = '2026-07-03'

function play(log: DailyActivityLog, date: string, score: number, windows: ('day' | 'week' | 'month' | 'all')[] = []) {
  return recordGameResult(log, date, score, windows)
}

describe('recordGameResult / gamesPlayed / maxScore', () => {
  it('accumulates games into the score histogram for the right date', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 5)
    log = play(log, D1, 12)
    log = play(log, D1, 5)
    log = play(log, D2, 20)

    expect(gamesPlayed(log[D1])).toBe(3)
    expect(gamesPlayed(log[D2])).toBe(1)
    expect(maxScore(log[D1])).toBe(12)
    expect(maxScore(log[D2])).toBe(20)
    expect(maxScore(log['2026-07-09'])).toBeNull()
  })

  it('counts each qualifying window separately per day', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 18, ['day'])
    log = play(log, D1, 20, ['day', 'week', 'all'])

    expect(log[D1].leaderboardHits).toEqual({ day: 2, week: 1, month: 0, all: 1 })
  })
})

describe('shortGamesCount', () => {
  it('counts games strictly below the threshold', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 3)
    log = play(log, D1, 9)
    log = play(log, D1, 10)
    log = play(log, D1, 15)

    expect(shortGamesCount(log[D1], 10)).toBe(2) // 3 and 9, not 10
  })

  it('returns 0 for a day with no games', () => {
    expect(shortGamesCount(undefined, 10)).toBe(0)
  })
})

describe('busiestDay', () => {
  it('finds the date with the most games across the whole log', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 5)
    log = play(log, D1, 6)
    log = play(log, D2, 7)
    log = play(log, D2, 8)
    log = play(log, D2, 9)
    log = play(log, D3, 4)

    expect(busiestDay(log)).toEqual({ date: D2, games: 3 })
  })

  it('returns null for an empty log', () => {
    expect(busiestDay({})).toBeNull()
  })
})

describe('bestScoreTrend', () => {
  it('only records a point on days the running best actually increased', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 10)
    log = play(log, D2, 8) // lower than the running best — no new point
    log = play(log, D3, 15)

    expect(bestScoreTrend(log)).toEqual([
      { date: D1, score: 10 },
      { date: D3, score: 15 },
    ])
  })

  it('is empty for an empty log', () => {
    expect(bestScoreTrend({})).toEqual([])
  })
})

describe('closestCalls', () => {
  it('counts games scoring exactly one below the given best', () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 19)
    log = play(log, D2, 19)
    log = play(log, D2, 20)
    log = play(log, D3, 18)

    expect(closestCalls(log, 20)).toBe(2)
  })

  it('returns 0 when the best is below 2', () => {
    expect(closestCalls({}, 1)).toBe(0)
    expect(closestCalls({}, 0)).toBe(0)
  })
})

describe('activityWindow', () => {
  it('returns a fixed-length, zero-filled, oldest-to-newest window ending today', () => {
    let log: DailyActivityLog = {}
    log = play(log, '2026-07-03', 5)
    log = play(log, '2026-07-05', 7)

    const window = activityWindow(log, '2026-07-05', 5)

    expect(window).toEqual([
      { date: '2026-07-01', games: 0 },
      { date: '2026-07-02', games: 0 },
      { date: '2026-07-03', games: 1 },
      { date: '2026-07-04', games: 0 },
      { date: '2026-07-05', games: 1 },
    ])
  })
})

describe('weeklyAverageDelta', () => {
  it('compares the trailing 7 days against the 7 days before that', () => {
    let log: DailyActivityLog = {}
    // This week (days 0-6 back from D... let's use a fixed "today").
    const today = '2026-07-14'
    log = play(log, today, 20) // day 0
    log = play(log, '2026-07-08', 10) // day 6
    // Last week (days 7-13 back).
    log = play(log, '2026-07-07', 5) // day 7
    log = play(log, '2026-07-01', 5) // day 13

    const delta = weeklyAverageDelta(log, today)

    expect(delta).toEqual({ thisWeek: 15, lastWeek: 5 })
  })

  it('returns null when either window has no games', () => {
    let log: DailyActivityLog = {}
    log = play(log, '2026-07-14', 10)
    expect(weeklyAverageDelta(log, '2026-07-14')).toBeNull()
  })
})

describe('todayReach', () => {
  it("summarizes today's game count and leaderboard hits", () => {
    let log: DailyActivityLog = {}
    log = play(log, D1, 18, ['day'])
    log = play(log, D1, 20, ['day', 'all'])
    log = play(log, D2, 5)

    expect(todayReach(log, D1)).toEqual({ gamesToday: 2, hits: { day: 2, week: 0, month: 0, all: 1 } })
  })

  it('returns zeros for a day with no entry', () => {
    expect(todayReach({}, D1)).toEqual({ gamesToday: 0, hits: { day: 0, week: 0, month: 0, all: 0 } })
  })
})
