import { useCallback, useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, unlockedAchievementIds, type Achievement, type AchievementContext } from '../game/achievements'
import type { StreakData } from '../game/daily'
import type { StatsData } from '../game/stats'

const STORAGE_KEY = 'order20-achievements-unlocked'

function readStoredUnlockedAt(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    )
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function writeStoredUnlockedAt(value: Record<string, number>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage unavailable — unlocks just won't persist across reloads.
  }
}

export function useAchievements(stats: StatsData, dailyStreak: StreakData) {
  const [unlockedAt, setUnlockedAt] = useState<Record<string, number>>(readStoredUnlockedAt)
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([])
  const isFirstSyncRef = useRef(true)
  const hadPriorHistoryRef = useRef(Object.keys(unlockedAt).length > 0)

  useEffect(() => {
    const ctx: AchievementContext = { stats, dailyStreak }
    const currentlyUnlocked = unlockedAchievementIds(ctx)
    const freshIds = currentlyUnlocked.filter(id => !(id in unlockedAt))
    const isFirstSync = isFirstSyncRef.current
    isFirstSyncRef.current = false
    if (freshIds.length === 0) return

    const timestamp = Date.now()
    setUnlockedAt(prev => {
      const next = { ...prev }
      for (const id of freshIds) next[id] = timestamp
      writeStoredUnlockedAt(next)
      return next
    })

    // A device with no unlock history yet — either a brand new player or
    // someone updating from before achievements existed — silently credits
    // whatever's already true from past play instead of firing a toast for
    // every achievement at once the moment this feature ships.
    const isSilentBackfill = isFirstSync && !hadPriorHistoryRef.current
    if (!isSilentBackfill) {
      setNewlyUnlocked(prev => [...prev, ...ACHIEVEMENTS.filter(achievement => freshIds.includes(achievement.id))])
    }
  }, [stats, dailyStreak, unlockedAt])

  // Stable identity: App.tsx uses this in a timeout-reset effect keyed off
  // the newlyUnlocked queue, and a fresh function reference on every render
  // would re-arm that timer constantly, so the toast would never auto-dismiss.
  const dismissNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked(prev => prev.slice(1))
  }, [])

  return { unlockedAt, newlyUnlocked, dismissNewlyUnlocked }
}
