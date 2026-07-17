import { useCallback, useState } from 'react'
import { createEmptyStats, recordGame, type Placement, type StatsData } from '../game/stats'

export const STATS_STORAGE_KEY = 'order20-stats'
const STORAGE_KEY = STATS_STORAGE_KEY

function isStatsData(value: unknown): value is StatsData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StatsData>
  return typeof candidate.totalGames === 'number' && Array.isArray(candidate.matrix)
}

function readStored(): StatsData {
  if (typeof window === 'undefined') return createEmptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyStats()
    const parsed: unknown = JSON.parse(raw)
    return isStatsData(parsed) ? parsed : createEmptyStats()
  } catch {
    return createEmptyStats()
  }
}

export function useGameStats() {
  const [stats, setStats] = useState<StatsData>(readStored)

  const recordCompletedGame = useCallback((placements: Placement[], result: 'won' | 'lost') => {
    setStats(prev => {
      const next = recordGame(prev, placements, result)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { stats, recordCompletedGame }
}
