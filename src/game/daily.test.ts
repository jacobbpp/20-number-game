import { describe, expect, it } from 'vitest'
import {
  DAILY_BOARD_SIZES,
  createDailyRng,
  createEmptyStreak,
  getDailyBoardSize,
  getLocalDateString,
  isStreakActive,
  recordDailyStreak,
} from './daily'

describe('getLocalDateString', () => {
  it('formats a date as YYYY-MM-DD, zero-padded', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(getLocalDateString(new Date(2026, 10, 23))).toBe('2026-11-23')
  })
})

describe('createDailyRng', () => {
  it('produces the exact same sequence for the same date', () => {
    const a = createDailyRng('2026-07-17')
    const b = createDailyRng('2026-07-17')
    const sequenceA = Array.from({ length: 10 }, () => a())
    const sequenceB = Array.from({ length: 10 }, () => b())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces a different sequence for a different date', () => {
    const a = createDailyRng('2026-07-17')
    const b = createDailyRng('2026-07-18')
    const sequenceA = Array.from({ length: 10 }, () => a())
    const sequenceB = Array.from({ length: 10 }, () => b())
    expect(sequenceA).not.toEqual(sequenceB)
  })

  it('produces values spread across the full [0, 1) range, not degenerate', () => {
    const rng = createDailyRng('2026-07-17')
    const values = Array.from({ length: 200 }, () => rng())
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    // A degenerate generator (e.g. always 0, or a short repeating cycle)
    // would fail this: with 200 draws we expect meaningfully more than a
    // handful of distinct values.
    expect(new Set(values).size).toBeGreaterThan(150)
  })
})

describe('streak tracking', () => {
  it('starts inactive with an empty streak', () => {
    expect(isStreakActive(createEmptyStreak(), '2026-07-17')).toBe(false)
  })

  it('first play ever sets the streak to 1', () => {
    const streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    expect(streak).toEqual({ count: 1, lastPlayedDate: '2026-07-17', bestStreak: 1 })
  })

  it('playing on consecutive days increments the streak', () => {
    let streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    streak = recordDailyStreak(streak, '2026-07-18')
    streak = recordDailyStreak(streak, '2026-07-19')
    expect(streak.count).toBe(3)
    expect(isStreakActive(streak, '2026-07-19')).toBe(true)
  })

  it('resets to 1 after skipping a day, without an explicit "broken" state', () => {
    let streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    streak = recordDailyStreak(streak, '2026-07-18')
    // Skip 2026-07-19 entirely, play again on the 20th.
    streak = recordDailyStreak(streak, '2026-07-20')
    expect(streak).toEqual({ count: 1, lastPlayedDate: '2026-07-20', bestStreak: 2 })
  })

  it('tracks bestStreak as the running max, surviving a broken streak', () => {
    let streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    streak = recordDailyStreak(streak, '2026-07-18')
    streak = recordDailyStreak(streak, '2026-07-19')
    expect(streak.bestStreak).toBe(3)

    // Break the streak — count resets, but the record stands.
    streak = recordDailyStreak(streak, '2026-07-25')
    expect(streak.count).toBe(1)
    expect(streak.bestStreak).toBe(3)
  })

  it('is still considered active the day after playing, before today is recorded', () => {
    const streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    // Haven't played 07-18 yet, but the streak shouldn't look broken until
    // a day is actually skipped.
    expect(isStreakActive(streak, '2026-07-18')).toBe(true)
  })

  it('is inactive once a day has been skipped', () => {
    const streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    expect(isStreakActive(streak, '2026-07-19')).toBe(false)
  })

  it('recording the same day twice is a no-op', () => {
    let streak = recordDailyStreak(createEmptyStreak(), '2026-07-17')
    const again = recordDailyStreak(streak, '2026-07-17')
    expect(again).toEqual(streak)
  })
})

describe('getDailyBoardSize', () => {
  it('is deterministic for the same date', () => {
    expect(getDailyBoardSize('2026-07-17')).toBe(getDailyBoardSize('2026-07-17'))
  })

  it('always returns a value from the curated set', () => {
    for (let day = 1; day <= 28; day++) {
      const date = `2026-07-${String(day).padStart(2, '0')}`
      expect(DAILY_BOARD_SIZES).toContain(getDailyBoardSize(date))
    }
  })

  it('is not the same size every day — genuine variety across a month', () => {
    const sizes = new Set<number>()
    for (let day = 1; day <= 28; day++) {
      const date = `2026-07-${String(day).padStart(2, '0')}`
      sizes.add(getDailyBoardSize(date))
    }
    expect(sizes.size).toBeGreaterThan(1)
  })

  it('is not simply derived from the same hash as the roll sequence', () => {
    // If size and rolls were seeded identically, this would be a suspicious
    // coincidence rather than a guarantee, but a shared seed source is
    // exactly the bug this test is meant to catch if introduced.
    const rngSeed = getDailyBoardSize('2026-07-17')
    const differentDateSameSize = Array.from({ length: 28 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)
      .filter(date => getDailyBoardSize(date) === rngSeed)
      .map(date => createDailyRng(date)())
    // Multiple dates can share a board size; their roll sequences must still differ.
    expect(new Set(differentDateSameSize).size).toBeGreaterThan(1)
  })
})
