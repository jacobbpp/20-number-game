import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAchievements } from './useAchievements'
import { createEmptyStreak } from '../game/daily'
import { createEmptyStats } from '../game/stats'

const STORAGE_KEY = 'order20-achievements-unlocked'

afterEach(() => {
  localStorage.clear()
})

describe('useAchievements', () => {
  it('starts with nothing unlocked and nothing queued for a fresh player', () => {
    const { result } = renderHook(() => useAchievements(createEmptyStats(), createEmptyStreak()))

    expect(result.current.unlockedAt).toEqual({})
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it('silently backfills already-satisfied achievements on first sync, without queuing a toast', () => {
    const stats = { ...createEmptyStats(), totalWins: 1, totalGames: 30 }

    const { result } = renderHook(() => useAchievements(stats, createEmptyStreak()))

    expect(Object.keys(result.current.unlockedAt)).toEqual(expect.arrayContaining(['first-win', 'dedicated']))
    expect(result.current.newlyUnlocked).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toHaveProperty('first-win')
  })

  it('queues a toast for a genuinely new unlock reached after the first sync', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak }) => useAchievements(stats, streak),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak() } },
    )

    expect(result.current.newlyUnlocked).toEqual([])

    act(() => {
      rerender({ stats: { ...createEmptyStats(), totalWins: 1 }, streak: createEmptyStreak() })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['first-win'])
    expect(result.current.unlockedAt).toHaveProperty('first-win')
  })

  it('does not re-queue an achievement that was already recorded on a previous device session', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'first-win': 12345 }))
    const stats = { ...createEmptyStats(), totalWins: 1 }

    const { result } = renderHook(() => useAchievements(stats, createEmptyStreak()))

    expect(result.current.unlockedAt['first-win']).toBe(12345)
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it('dismissNewlyUnlocked pops the queue one at a time, FIFO', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak }) => useAchievements(stats, streak),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak() } },
    )

    act(() => {
      rerender({ stats: { ...createEmptyStats(), totalWins: 1, bestWinStreak: 3 }, streak: createEmptyStreak() })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['first-win', 'win-streak-3'])

    act(() => {
      result.current.dismissNewlyUnlocked()
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['win-streak-3'])
  })
})
