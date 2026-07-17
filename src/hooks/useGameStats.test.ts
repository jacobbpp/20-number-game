import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STATS_STORAGE_KEY, useGameStats } from './useGameStats'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('useGameStats', () => {
  it('fills in totalWins/totalTurns/lossBucketCounts for stats saved before those fields existed', () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 5,
        matrix: Array.from({ length: 20 }, () => Array(10).fill(0)),
        lastGame: null,
      }),
    )

    const { result } = renderHook(() => useGameStats())

    expect(result.current.stats.totalGames).toBe(5)
    expect(result.current.stats.totalWins).toBe(0)
    expect(result.current.stats.totalTurns).toBe(0)
    expect(result.current.stats.lossBucketCounts).toEqual(Array(10).fill(0))
  })

  it('fills in winTurns/currentWinStreak/closeCallCount/scoreDistribution/winMatrix/lossMatrix for older stats', () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 5,
        totalWins: 2,
        totalTurns: 40,
        matrix: Array.from({ length: 20 }, () => Array(10).fill(0)),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    const { result } = renderHook(() => useGameStats())

    expect(result.current.stats.winTurns).toBe(0)
    expect(result.current.stats.currentWinStreak).toBe(0)
    expect(result.current.stats.closeCallCount).toBe(0)
    expect(result.current.stats.scoreDistribution).toEqual([0, 0, 0, 0])
    expect(result.current.stats.winMatrix).toEqual(Array.from({ length: 20 }, () => Array(10).fill(0)))
    expect(result.current.stats.lossMatrix).toEqual(Array.from({ length: 20 }, () => Array(10).fill(0)))
    // Pre-existing fields still survive the upgrade.
    expect(result.current.stats.totalGames).toBe(5)
    expect(result.current.stats.totalWins).toBe(2)
  })

  it('records the losing roll into lossBucketCounts', () => {
    const { result } = renderHook(() => useGameStats())

    act(() => {
      result.current.recordCompletedGame([{ position: 0, value: 10 }], 'lost', 250)
    })

    expect(result.current.stats.lossBucketCounts[2]).toBe(1)
    expect(result.current.stats.totalWins).toBe(0)
    expect(result.current.stats.totalTurns).toBe(1)
  })

  it('defaults losingValue to null so a win never touches lossBucketCounts', () => {
    const { result } = renderHook(() => useGameStats())

    act(() => {
      result.current.recordCompletedGame([{ position: 0, value: 10 }], 'won')
    })

    expect(result.current.stats.totalWins).toBe(1)
    expect(result.current.stats.lossBucketCounts.every(c => c === 0)).toBe(true)
  })

  it('threads a passed board size through to scoreDistribution/closeCallCount', () => {
    const { result } = renderHook(() => useGameStats())

    act(() => {
      // 8 of 10 placed on a 10-slot board — within the close-call margin for
      // that board size, even though it wouldn't be for a 20-slot one.
      result.current.recordCompletedGame(
        Array.from({ length: 8 }, (_, i) => ({ position: i, value: i + 1 })),
        'lost',
        999,
        10,
      )
    })

    expect(result.current.stats.closeCallCount).toBe(1)
  })

  it('keeps the in-memory update even when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useGameStats())

    expect(() => {
      act(() => {
        result.current.recordCompletedGame([{ position: 0, value: 10 }], 'won')
      })
    }).not.toThrow()

    expect(result.current.stats.totalWins).toBe(1)
  })
})
