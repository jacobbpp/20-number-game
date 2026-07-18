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
    const { result } = renderHook(() => useAchievements(createEmptyStats(), createEmptyStreak(), 0))

    expect(result.current.unlockedAt).toEqual({})
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it('silently backfills already-satisfied achievements on first sync, without queuing a toast', () => {
    const stats = { ...createEmptyStats(), totalWins: 1, totalGames: 30 }

    const { result } = renderHook(() => useAchievements(stats, createEmptyStreak(), 0))

    expect(Object.keys(result.current.unlockedAt)).toEqual(expect.arrayContaining(['first-win', 'dedicated']))
    expect(result.current.newlyUnlocked).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toHaveProperty('first-win')
  })

  it('queues a toast for a genuinely new unlock reached after the first sync', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak, bestScore }) => useAchievements(stats, streak, bestScore),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 0 } },
    )

    expect(result.current.newlyUnlocked).toEqual([])

    act(() => {
      rerender({ stats: { ...createEmptyStats(), totalWins: 1 }, streak: createEmptyStreak(), bestScore: 0 })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['first-win'])
    expect(result.current.unlockedAt).toHaveProperty('first-win')
  })

  it('does not re-queue an achievement that was already recorded on a previous device session', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'first-win': 12345 }))
    const stats = { ...createEmptyStats(), totalWins: 1 }

    const { result } = renderHook(() => useAchievements(stats, createEmptyStreak(), 0))

    expect(result.current.unlockedAt['first-win']).toBe(12345)
    expect(result.current.newlyUnlocked).toEqual([])
  })

  it('dismissNewlyUnlocked pops the queue one at a time, FIFO', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak, bestScore }) => useAchievements(stats, streak, bestScore),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 0 } },
    )

    act(() => {
      rerender({ stats: { ...createEmptyStats(), totalWins: 1, bestWinStreak: 3 }, streak: createEmptyStreak(), bestScore: 0 })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['first-win', 'win-streak-3'])

    act(() => {
      result.current.dismissNewlyUnlocked()
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['win-streak-3'])
  })

  it('collapses several score milestones crossed at once into a toast for only the highest one', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak, bestScore }) => useAchievements(stats, streak, bestScore),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 0 } },
    )

    act(() => {
      rerender({ stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 12 })
    })

    // All 12 are genuinely unlocked...
    for (let n = 1; n <= 12; n++) expect(result.current.unlockedAt).toHaveProperty(`score-${n}`)
    // ...but only the highest one queues a toast.
    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['score-12'])
  })

  it('still toasts a named achievement individually even when it lands alongside a batch of milestones', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak, bestScore }) => useAchievements(stats, streak, bestScore),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 0 } },
    )

    act(() => {
      rerender({ stats: { ...createEmptyStats(), totalWins: 1 }, streak: createEmptyStreak(), bestScore: 5 })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['first-win', 'score-5'])
  })

  it('gives each game its own milestone toast rather than batching across separate syncs', () => {
    const { result, rerender } = renderHook(
      ({ stats, streak, bestScore }) => useAchievements(stats, streak, bestScore),
      { initialProps: { stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 0 } },
    )

    act(() => {
      rerender({ stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 5 })
    })
    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['score-5'])

    act(() => {
      result.current.dismissNewlyUnlocked()
    })
    act(() => {
      rerender({ stats: createEmptyStats(), streak: createEmptyStreak(), bestScore: 12 })
    })

    expect(result.current.newlyUnlocked.map(a => a.id)).toEqual(['score-12'])
  })
})
