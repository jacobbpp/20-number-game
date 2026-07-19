import { describe, expect, it } from 'vitest'
import { describeLeaderboardReach, summarizeActivity, type LeaderboardActivityEntry } from './leaderboardActivity'

describe('summarizeActivity', () => {
  it('counts only today\'s entries, ignoring other dates', () => {
    const log: LeaderboardActivityEntry[] = [
      { date: '2026-07-19', windows: [] },
      { date: '2026-07-18', windows: ['day', 'all'] },
      { date: '2026-07-19', windows: ['day'] },
    ]

    const summary = summarizeActivity(log, '2026-07-19')

    expect(summary.gamesToday).toBe(2)
    expect(summary.madeToday).toEqual({ day: 1, week: 0, month: 0, all: 0 })
  })

  it('counts a single game across every window it qualified for', () => {
    const log: LeaderboardActivityEntry[] = [{ date: '2026-07-19', windows: ['day', 'week', 'month', 'all'] }]

    const summary = summarizeActivity(log, '2026-07-19')

    expect(summary.madeToday).toEqual({ day: 1, week: 1, month: 1, all: 1 })
  })

  it('returns all zeros for a day with no games', () => {
    const summary = summarizeActivity([], '2026-07-19')

    expect(summary).toEqual({ gamesToday: 0, madeToday: { day: 0, week: 0, month: 0, all: 0 } })
  })
})

describe('describeLeaderboardReach', () => {
  it('returns null when no games have been played today', () => {
    expect(describeLeaderboardReach({ gamesToday: 0, madeToday: { day: 0, week: 0, month: 0, all: 0 } })).toBeNull()
  })

  it('returns null when games were played today but none qualified for anything', () => {
    expect(describeLeaderboardReach({ gamesToday: 5, madeToday: { day: 0, week: 0, month: 0, all: 0 } })).toBeNull()
  })

  it('describes a single qualifying window', () => {
    const text = describeLeaderboardReach({ gamesToday: 12, madeToday: { day: 5, week: 0, month: 0, all: 0 } })
    expect(text).toBe("12 games played today. 5 made today's board.")
  })

  it('joins multiple qualifying windows with a trailing "and"', () => {
    const text = describeLeaderboardReach({ gamesToday: 12, madeToday: { day: 5, week: 2, month: 0, all: 1 } })
    expect(text).toBe("12 games played today. 5 made today's board, 2 made this week's, and 1 made the all-time board.")
  })

  it('uses singular "game" for exactly one game played', () => {
    const text = describeLeaderboardReach({ gamesToday: 1, madeToday: { day: 1, week: 0, month: 0, all: 0 } })
    expect(text).toBe("1 game played today. 1 made today's board.")
  })
})
