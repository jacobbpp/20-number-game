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

// A single great game can cross several score milestones at once (e.g.
// 3/20 straight to 12/20). Announcing each one separately would mean a
// string of near-identical toasts, so only the highest milestone reached
// this sync gets queued — SCORE_MILESTONES (and therefore ACHIEVEMENTS) is
// generated in ascending order, so the last score-* entry in the list is
// always the highest one. Named achievements are unaffected and each still
// get their own toast.
function collapseMilestoneToasts(freshlyUnlocked: Achievement[]): Achievement[] {
  const milestoneIndexes: number[] = []
  freshlyUnlocked.forEach((achievement, index) => {
    if (achievement.id.startsWith('score-')) milestoneIndexes.push(index)
  })
  if (milestoneIndexes.length <= 1) return freshlyUnlocked

  const keepIndex = milestoneIndexes[milestoneIndexes.length - 1]
  return freshlyUnlocked.filter((_, index) => !milestoneIndexes.includes(index) || index === keepIndex)
}

export function useAchievements(stats: StatsData, dailyStreak: StreakData, bestScore: number) {
  const [unlockedAt, setUnlockedAt] = useState<Record<string, number>>(readStoredUnlockedAt)
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([])
  const isFirstSyncRef = useRef(true)
  const hadPriorHistoryRef = useRef(Object.keys(unlockedAt).length > 0)

  useEffect(() => {
    const ctx: AchievementContext = { stats, dailyStreak, bestScore }
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
      const fresh = ACHIEVEMENTS.filter(achievement => freshIds.includes(achievement.id))
      setNewlyUnlocked(prev => [...prev, ...collapseMilestoneToasts(fresh)])
    }
  }, [stats, dailyStreak, bestScore, unlockedAt])

  // Stable identity: App.tsx uses this in a timeout-reset effect keyed off
  // the newlyUnlocked queue, and a fresh function reference on every render
  // would re-arm that timer constantly, so the toast would never auto-dismiss.
  const dismissNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked(prev => prev.slice(1))
  }, [])

  return { unlockedAt, newlyUnlocked, dismissNewlyUnlocked }
}
