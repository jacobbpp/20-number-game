import { describe, expect, it } from 'vitest'
import {
  bucketForValue,
  computeInsight,
  createEmptyStats,
  extractPlacements,
  recordGame,
  type StatsData,
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
})

describe('computeInsight', () => {
  function statsWithHistory(): StatsData {
    let stats = createEmptyStats()
    // Bucket 5 (501-600) has landed at position 9 three times — a clear pattern.
    for (let i = 0; i < 3; i++) {
      stats = recordGame(stats, [{ position: 9, value: 550 + i }], 'won')
    }
    return stats
  }

  it('returns null when there is not enough game history', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 9, value: 550 }], 'won')
    expect(computeInsight(stats)).toBeNull()
  })

  it('returns null when there is no last game recorded', () => {
    expect(computeInsight(createEmptyStats())).toBeNull()
  })

  it('reports a mismatch when the last game broke from the established pattern', () => {
    let stats = statsWithHistory()
    stats = recordGame(stats, [{ position: 13, value: 588 }], 'lost')

    const insight = computeInsight(stats)
    expect(insight).toEqual({ kind: 'mismatch', position: 13, value: 588, bucket: 5, usualPosition: 9 })
  })

  it('reports a match when the last game followed the established pattern', () => {
    let stats = statsWithHistory()
    stats = recordGame(stats, [{ position: 9, value: 588 }], 'won')

    const insight = computeInsight(stats)
    expect(insight).toEqual({ kind: 'match', position: 9, value: 588, bucket: 5, usualPosition: 9 })
  })

  it('ignores buckets without enough signal yet', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 0, value: 10 }], 'won')
    stats = recordGame(stats, [{ position: 1, value: 20 }], 'won')
    stats = recordGame(stats, [{ position: 2, value: 900 }], 'lost')

    expect(computeInsight(stats)).toBeNull()
  })

  it('does not count the last game itself as one of its own two required precedents', () => {
    let stats = createEmptyStats()
    // Unrelated filler game, purely to satisfy the "at least 3 total games"
    // gate without adding any real signal to bucket 5 / position 9.
    stats = recordGame(stats, [{ position: 15, value: 850 }], 'won')
    // Exactly one genuine PRIOR game placed bucket 5 at position 9.
    stats = recordGame(stats, [{ position: 9, value: 550 }], 'won')
    // This game repeats it — raw matrix count is now 2, but only 1 of those
    // is a real precedent; the fix must not treat that as an established pattern.
    stats = recordGame(stats, [{ position: 9, value: 560 }], 'won')

    expect(computeInsight(stats)).toBeNull()
  })

  it('still reports a match once there are two genuine prior precedents', () => {
    let stats = createEmptyStats()
    stats = recordGame(stats, [{ position: 9, value: 550 }], 'won')
    stats = recordGame(stats, [{ position: 9, value: 560 }], 'won')
    // Third game at the same spot: 2 real precedents plus this one.
    stats = recordGame(stats, [{ position: 9, value: 570 }], 'won')

    const insight = computeInsight(stats)
    expect(insight).toEqual({ kind: 'match', position: 9, value: 570, bucket: 5, usualPosition: 9 })
  })
})
