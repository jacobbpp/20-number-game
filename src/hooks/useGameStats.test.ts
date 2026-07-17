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
