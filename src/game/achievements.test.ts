import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, unlockedAchievementIds, type AchievementContext } from './achievements'
import { createEmptyStreak } from './daily'
import { createEmptyStats } from './stats'

function baseContext(): AchievementContext {
  return { stats: createEmptyStats(), dailyStreak: createEmptyStreak() }
}

function find(id: string) {
  const achievement = ACHIEVEMENTS.find(a => a.id === id)
  if (!achievement) throw new Error(`missing achievement ${id}`)
  return achievement
}

describe('achievement unlock conditions', () => {
  it('first-win unlocks at totalWins 1, not before', () => {
    const ctx = baseContext()
    expect(find('first-win').isUnlocked(ctx)).toBe(false)
    ctx.stats.totalWins = 1
    expect(find('first-win').isUnlocked(ctx)).toBe(true)
  })

  it('win-streak-3 requires bestWinStreak of at least 3', () => {
    const ctx = baseContext()
    ctx.stats.bestWinStreak = 2
    expect(find('win-streak-3').isUnlocked(ctx)).toBe(false)
    ctx.stats.bestWinStreak = 3
    expect(find('win-streak-3').isUnlocked(ctx)).toBe(true)
  })

  it('win-streak-5 requires bestWinStreak of at least 5', () => {
    const ctx = baseContext()
    ctx.stats.bestWinStreak = 4
    expect(find('win-streak-5').isUnlocked(ctx)).toBe(false)
    ctx.stats.bestWinStreak = 5
    expect(find('win-streak-5').isUnlocked(ctx)).toBe(true)
  })

  it('fearless requires at least one hard-mode win', () => {
    const ctx = baseContext()
    expect(find('fearless').isUnlocked(ctx)).toBe(false)
    ctx.stats.hardModeWins = 1
    expect(find('fearless').isUnlocked(ctx)).toBe(true)
  })

  it('dedicated requires 25 total games', () => {
    const ctx = baseContext()
    ctx.stats.totalGames = 24
    expect(find('dedicated').isUnlocked(ctx)).toBe(false)
    ctx.stats.totalGames = 25
    expect(find('dedicated').isUnlocked(ctx)).toBe(true)
  })

  it('century requires 100 total games', () => {
    const ctx = baseContext()
    ctx.stats.totalGames = 99
    expect(find('century').isUnlocked(ctx)).toBe(false)
    ctx.stats.totalGames = 100
    expect(find('century').isUnlocked(ctx)).toBe(true)
  })

  it('week-streak requires a daily bestStreak of at least 7', () => {
    const ctx = baseContext()
    ctx.dailyStreak.bestStreak = 6
    expect(find('week-streak').isUnlocked(ctx)).toBe(false)
    ctx.dailyStreak.bestStreak = 7
    expect(find('week-streak').isUnlocked(ctx)).toBe(true)
  })
})

describe('unlockedAchievementIds', () => {
  it('returns an empty list for a fresh context', () => {
    expect(unlockedAchievementIds(baseContext())).toEqual([])
  })

  it('returns every achievement whose condition is met, in list order', () => {
    const ctx = baseContext()
    ctx.stats.totalWins = 1
    ctx.stats.bestWinStreak = 5
    ctx.stats.totalGames = 100

    expect(unlockedAchievementIds(ctx)).toEqual(['first-win', 'win-streak-3', 'win-streak-5', 'dedicated', 'century'])
  })
})
