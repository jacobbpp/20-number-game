import { describe, expect, it } from 'vitest'
import {
  averageTurns,
  averageTurnsInWins,
  bucketForValue,
  createEmptyStats,
  describeScoreDistribution,
  extractPlacements,
  bestValueRange,
  mostCommonLossBucket,
  recordGame,
  scoreBucketForCount,
  scoreBucketLabel,
} from './stats'

describe('bucketForValue', () => {
  it('buckets values into ten ranges of 100', () => {
    expect(bucketForValue(1)).toBe(0)
    expect(bucketForValue(100)).toBe(0)
    expect(bucketForValue(101)).toBe(1)
    expect(bucketForValue(500)).toBe(4)
    expect(bucketForValue(501)).toBe(5)
    expect(bucketForValue(999)).toBe(9)
    expect(bucketForValue(1000)).toBe(9)
  })
})

describe('extractPlacements', () => {
  it('collects only filled positions with their values', () => {
    const positions = [64, null, null, 75, null]
    expect(extractPlacements(positions)).toEqual([
      { position: 0, value: 64 },
      { position: 3, value: 75 },
    ])
  })
})

describe('recordGame', () => {
  it('increments the matrix cell for each placement without mutating the input', () => {
    const stats = createEmptyStats()
    const placements = [
      { position: 9, value: 550 }, // bucket 5
      { position: 2, value: 40 }, // bucket 0
    ]
    const next = recordGame(stats, placements, 'lost')

    expect(next.matrix[9][5]).toBe(1)
    expect(next.matrix[2][0]).toBe(1)
    expect(next.totalGames).toBe(1)
    expect(next.lastGame).toEqual({ placements, result: 'lost', timestamp: expect.any(Number) })

    // original stats object must be untouched
    expect(stats.matrix[9][5]).toBe(0)
    expect(stats.totalGames).toBe(0)
  })

  it('accumulates counts across repeated games', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 9, value: 550 }], 'won')
    stats = recordGame(stats, [{ position: 9, value: 560 }], 'won')
    expect(stats.matrix[9][5]).toBe(2)
    expect(stats.totalGames).toBe(2)
  })

  it('tracks wins, turns, and the losing roll bucket', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }, { position: 1, value: 20 }], 'won')
    stats = recordGame(stats, [{ position: 2, value: 30 }], 'lost', 250)

    expect(stats.totalGames).toBe(2)
    expect(stats.totalWins).toBe(1)
    expect(stats.totalTurns).toBe(3)
    expect(stats.lossBucketCounts[2]).toBe(1) // bucket for 250 is index 2
    expect(stats.lossBucketCounts.filter(c => c > 0)).toHaveLength(1)
  })

  it('does not touch lossBucketCounts for a win, even if a losingValue is passed', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'won', 250)
    expect(stats.lossBucketCounts.every(c => c === 0)).toBe(true)
  })

  it('counts a win toward hardModeWins only when hard mode was on', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'won', null, 20, true)
    stats = recordGame(stats, [{ position: 1, value: 20 }], 'won', null, 20, false)
    expect(stats.hardModeWins).toBe(1)
  })

  it('does not count a hard-mode loss toward hardModeWins', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'lost', 900, 20, true)
    expect(stats.hardModeWins).toBe(0)
  })

  it('counts every hard-mode game toward hardModeGames, win or lose', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'won', null, 20, true)
    stats = recordGame(stats, [{ position: 1, value: 20 }], 'lost', 900, 20, true)
    stats = recordGame(stats, [{ position: 2, value: 30 }], 'won', null, 20, false)
    expect(stats.hardModeGames).toBe(2)
    expect(stats.hardModeWins).toBe(1)
  })

  it('tracks winTurns and resets currentWinStreak on a loss', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }, { position: 1, value: 20 }], 'won', null, 20)
    stats = recordGame(stats, [{ position: 2, value: 30 }], 'won', null, 20)
    expect(stats.winTurns).toBe(3)
    expect(stats.currentWinStreak).toBe(2)

    stats = recordGame(stats, [{ position: 3, value: 40 }], 'lost', 40, 20)
    expect(stats.winTurns).toBe(3) // unchanged by the loss
    expect(stats.currentWinStreak).toBe(0)
  })

  it('remembers bestWinStreak across a loss instead of resetting it with currentWinStreak', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'won')
    stats = recordGame(stats, [{ position: 1, value: 20 }], 'won')
    stats = recordGame(stats, [{ position: 2, value: 30 }], 'won')
    expect(stats.currentWinStreak).toBe(3)
    expect(stats.bestWinStreak).toBe(3)

    stats = recordGame(stats, [{ position: 3, value: 40 }], 'lost', 40)
    expect(stats.currentWinStreak).toBe(0)
    expect(stats.bestWinStreak).toBe(3) // the record survives the loss

    // A new streak that doesn't beat the old record shouldn't lower it.
    stats = recordGame(stats, [{ position: 4, value: 50 }], 'won')
    expect(stats.currentWinStreak).toBe(1)
    expect(stats.bestWinStreak).toBe(3)
  })

  it('buckets placedCount into scoreDistribution relative to the board size', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, Array.from({ length: 3 }, (_, i) => ({ position: i, value: i + 1 })), 'lost', 999, 20) // bucket 0 (0-5)
    stats = recordGame(stats, Array.from({ length: 18 }, (_, i) => ({ position: i, value: i + 1 })), 'lost', 999, 20) // bucket 3 (16-20)
    expect(stats.scoreDistribution).toEqual([1, 0, 0, 1])
  })

  it('splits the matrix into winMatrix/lossMatrix while still updating the combined matrix', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 9, value: 550 }], 'won')
    stats = recordGame(stats, [{ position: 9, value: 560 }], 'lost', 560)

    expect(stats.matrix[9][5]).toBe(2)
    expect(stats.winMatrix[9][5]).toBe(1)
    expect(stats.lossMatrix[9][5]).toBe(1)
  })
})

describe('averageTurnsInWins', () => {
  it('returns null with no wins', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'lost', 10)
    expect(averageTurnsInWins(stats)).toBeNull()
  })

  it('averages placements per game across wins only, ignoring losses', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'lost', 10) // shouldn't count
    stats = recordGame(stats, [
      { position: 0, value: 10 },
      { position: 1, value: 20 },
    ], 'won')
    stats = recordGame(stats, [
      { position: 0, value: 10 },
      { position: 1, value: 20 },
      { position: 2, value: 30 },
      { position: 3, value: 40 },
    ], 'won')
    expect(averageTurnsInWins(stats)).toBe(3)
  })
})

describe('scoreBucketForCount / scoreBucketLabel', () => {
  it('splits a 20-slot board into four even ranges', () => {
    expect(scoreBucketForCount(0, 20)).toBe(0)
    expect(scoreBucketForCount(5, 20)).toBe(1)
    expect(scoreBucketForCount(10, 20)).toBe(2)
    expect(scoreBucketForCount(15, 20)).toBe(3)
    expect(scoreBucketForCount(20, 20)).toBe(3)

    expect(scoreBucketLabel(0, 20)).toBe('0–5')
    expect(scoreBucketLabel(1, 20)).toBe('6–10')
    expect(scoreBucketLabel(2, 20)).toBe('11–15')
    expect(scoreBucketLabel(3, 20)).toBe('16–20')
  })
})

describe('describeScoreDistribution', () => {
  it('renders every bucket as a spoken sentence fragment, singular/plural aware', () => {
    expect(describeScoreDistribution([1, 0, 3, 5], 20)).toBe(
      '1 game placed 0–5, 0 games placed 6–10, 3 games placed 11–15, 5 games placed 16–20',
    )
  })
})

describe('averageTurns', () => {
  it('returns null with no games played', () => {
    expect(averageTurns(createEmptyStats())).toBeNull()
  })

  it('averages placements per game across all recorded games', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }, { position: 1, value: 20 }], 'won')
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'lost', 10)
    expect(averageTurns(stats)).toBe(1.5)
  })
})

describe('mostCommonLossBucket', () => {
  it('returns null with fewer than three losses', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [], 'lost', 10)
    stats = recordGame(stats, [], 'lost', 10)
    expect(mostCommonLossBucket(stats)).toBeNull()
  })

  it('returns the bucket with the most losses once there is enough signal', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [], 'lost', 250) // bucket 2
    stats = recordGame(stats, [], 'lost', 260) // bucket 2
    stats = recordGame(stats, [], 'lost', 850) // bucket 8
    stats = recordGame(stats, [], 'lost', 270) // bucket 2 — now the clear majority
    expect(mostCommonLossBucket(stats)).toBe(2)
  })
})

describe('bestValueRange', () => {
  it('returns null when no bucket has enough placements behind it', () => {
    const stats = createEmptyStats()
    stats.winMatrix[0][2] = 1
    stats.lossMatrix[1][2] = 1
    expect(bestValueRange(stats)).toBeNull()
  })

  it('returns the bucket with the highest win-association ratio once there is enough signal', () => {
    const stats = createEmptyStats()
    // bucket 2: 4 wins, 1 loss -> 80%
    stats.winMatrix[0][2] = 4
    stats.lossMatrix[1][2] = 1
    // bucket 5: 1 win, 4 losses -> 20%
    stats.winMatrix[2][5] = 1
    stats.lossMatrix[3][5] = 4
    expect(bestValueRange(stats)).toEqual({ bucket: 2, winRatePercent: 80 })
  })
})

