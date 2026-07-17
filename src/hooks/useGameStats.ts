import { useCallback, useState } from 'react'
import { createEmptyLossBucketCounts, createEmptyStats, recordGame, VALUE_BUCKETS, type Placement, type StatsData } from '../game/stats'

export const STATS_STORAGE_KEY = 'order20-stats'
const STORAGE_KEY = STATS_STORAGE_KEY

function isStatsData(value: unknown): value is StatsData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StatsData>
  return typeof candidate.totalGames === 'number' && Array.isArray(candidate.matrix)
}

// Stats saved before totalWins/totalTurns/lossBucketCounts existed are
// missing those fields entirely — fill them in rather than reject the whole
// record, so existing totalGames/matrix history survives the upgrade.
function normalizeStats(data: StatsData): StatsData {
  return {
    totalGames: data.totalGames,
    totalWins: typeof data.totalWins === 'number' ? data.totalWins : 0,
    totalTurns: typeof data.totalTurns === 'number' ? data.totalTurns : 0,
    matrix: data.matrix,
    lossBucketCounts:
      Array.isArray(data.lossBucketCounts) && data.lossBucketCounts.length === VALUE_BUCKETS
        ? data.lossBucketCounts
        : createEmptyLossBucketCounts(),
    lastGame: data.lastGame,
  }
}

function readStored(): StatsData {
  if (typeof window === 'undefined') return createEmptyStats()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyStats()
    const parsed: unknown = JSON.parse(raw)
    return isStatsData(parsed) ? normalizeStats(parsed) : createEmptyStats()
  } catch {
    return createEmptyStats()
  }
}

export function useGameStats() {
  const [stats, setStats] = useState<StatsData>(readStored)

  const recordCompletedGame = useCallback((placements: Placement[], result: 'won' | 'lost', losingValue: number | null = null) => {
    setStats(prev => {
      const next = recordGame(prev, placements, result, losingValue)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable (private browsing, quota, etc.) — stats just won't persist across reloads.
      }
      return next
    })
  }, [])

  return { stats, recordCompletedGame }
}
