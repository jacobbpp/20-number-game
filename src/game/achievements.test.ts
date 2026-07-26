import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, SCORE_MILESTONES, unlockedAchievementIds, type AchievementContext } from './achievements'
import { createEmptyStreak } from './daily'
import { createEmptyStats } from './stats'

function baseContext(): AchievementContext {
  return { stats: createEmptyStats(), dailyStreak: createEmptyStreak(), bestScore: 0, dailyHistory: [], dailyActivity: {} }
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

  it('daily-win unlocks once any recorded daily attempt has status won', () => {
    const ctx = baseContext()
    ctx.dailyHistory = [{ date: '2026-01-01', positions: [], placedCount: 10, status: 'lost', lossReason: 'no legal move' }]
    expect(find('daily-win').isUnlocked(ctx)).toBe(false)

    ctx.dailyHistory = [{ date: '2026-01-01', positions: [], placedCount: 10, status: 'won', lossReason: null }]
    expect(find('daily-win').isUnlocked(ctx)).toBe(true)
  })

  it('made-leaderboard unlocks once any recorded day has a leaderboard hit in any window', () => {
    const ctx = baseContext()
    ctx.dailyActivity = {
      '2026-01-01': { date: '2026-01-01', scoreHistogram: [], leaderboardHits: { day: 0, week: 0, month: 0, all: 0 } },
    }
    expect(find('made-leaderboard').isUnlocked(ctx)).toBe(false)

    ctx.dailyActivity = {
      '2026-01-01': { date: '2026-01-01', scoreHistogram: [], leaderboardHits: { day: 0, week: 1, month: 0, all: 0 } },
    }
    expect(find('made-leaderboard').isUnlocked(ctx)).toBe(true)
  })

  it('neighbours unlocks when two adjacent positions land in adjacent value buckets', () => {
    const ctx = baseContext()
    ctx.stats.lastGame = {
      placements: [
        { position: 0, value: 150 },
        { position: 1, value: 550 },
      ],
      result: 'lost',
      timestamp: 0,
    }
    expect(find('neighbours').isUnlocked(ctx)).toBe(false)

    ctx.stats.lastGame = {
      placements: [
        { position: 0, value: 150 },
        { position: 1, value: 250 },
      ],
      result: 'lost',
      timestamp: 0,
    }
    expect(find('neighbours').isUnlocked(ctx)).toBe(true)
  })

  it('the-alexander unlocks when a 1 or 1000 lands away from the very first or last position', () => {
    const ctx = baseContext()
    ctx.stats.lastGame = { placements: [{ position: 0, value: 1 }], result: 'lost', timestamp: 0 }
    expect(find('the-alexander').isUnlocked(ctx)).toBe(false)

    ctx.stats.lastGame = { placements: [{ position: 1, value: 1 }], result: 'lost', timestamp: 0 }
    expect(find('the-alexander').isUnlocked(ctx)).toBe(true)

    ctx.stats.lastGame = { placements: [{ position: 19, value: 1000 }], result: 'lost', timestamp: 0 }
    expect(find('the-alexander').isUnlocked(ctx)).toBe(false)

    ctx.stats.lastGame = { placements: [{ position: 18, value: 1000 }], result: 'lost', timestamp: 0 }
    expect(find('the-alexander').isUnlocked(ctx)).toBe(true)
  })

  it('two-ends requires both a 1 and a 1000 in the same game', () => {
    const ctx = baseContext()
    ctx.stats.lastGame = { placements: [{ position: 0, value: 1 }], result: 'lost', timestamp: 0 }
    expect(find('two-ends').isUnlocked(ctx)).toBe(false)

    ctx.stats.lastGame = {
      placements: [
        { position: 0, value: 1 },
        { position: 19, value: 1000 },
      ],
      result: 'won',
      timestamp: 0,
    }
    expect(find('two-ends').isUnlocked(ctx)).toBe(true)
  })

  it('full-spectrum requires a placement from every one of the 10 hundreds', () => {
    const ctx = baseContext()
    const nineBuckets = [50, 150, 250, 350, 450, 550, 650, 750, 850].map((value, position) => ({ position, value }))
    ctx.stats.lastGame = { placements: nineBuckets, result: 'lost', timestamp: 0 }
    expect(find('full-spectrum').isUnlocked(ctx)).toBe(false)

    const allTenBuckets = [...nineBuckets, { position: 9, value: 950 }]
    ctx.stats.lastGame = { placements: allTenBuckets, result: 'won', timestamp: 0 }
    expect(find('full-spectrum').isUnlocked(ctx)).toBe(true)
  })
})

describe('score milestones', () => {
  it('produces one milestone per board slot, 1 through 20, in ascending order', () => {
    expect(SCORE_MILESTONES).toHaveLength(20)
    expect(SCORE_MILESTONES.map(m => m.id)).toEqual(Array.from({ length: 20 }, (_, i) => `score-${i + 1}`))
    expect(SCORE_MILESTONES[0].title).toBe('1/20')
    expect(SCORE_MILESTONES[19].title).toBe('20/20')
  })

  it('unlocks a milestone once bestScore reaches it, not before', () => {
    const ctx = baseContext()
    ctx.bestScore = 11
    expect(SCORE_MILESTONES[10].isUnlocked(ctx)).toBe(true) // score-11
    expect(SCORE_MILESTONES[11].isUnlocked(ctx)).toBe(false) // score-12
  })

  it('a single high bestScore unlocks every milestone up to it', () => {
    const ctx = baseContext()
    ctx.bestScore = 20
    expect(SCORE_MILESTONES.every(m => m.isUnlocked(ctx))).toBe(true)
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
