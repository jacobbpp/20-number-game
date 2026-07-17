import { useCallback, useState } from 'react'
import {
  createEmptyLossBucketCounts,
  createEmptyMatrix,
  createEmptyScoreDistribution,
  createEmptyStats,
  recordGame,
  SCORE_BUCKETS,
  VALUE_BUCKETS,
  type Placement,
  type StatsData,
} from '../game/stats'
import { BOARD_SIZE } from '../game/types'

export const STATS_STORAGE_KEY = 'order20-stats'
const STORAGE_KEY = STATS_STORAGE_KEY

function isStatsData(value: unknown): value is StatsData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StatsData>
  return typeof candidate.totalGames === 'number' && Array.isArray(candidate.matrix)
}

function isMatrix(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length === BOARD_SIZE && value.every(row => Array.isArray(row) && row.length === VALUE_BUCKETS)
}

// Stats saved before a field existed are missing it entirely — fill in
// defaults rather than reject the whole record, so existing totalGames/matrix
// history survives every upgrade.
function normalizeStats(data: StatsData): StatsData {
  return {
    totalGames: data.totalGames,
    totalWins: typeof data.totalWins === 'number' ? data.totalWins : 0,
    totalTurns: typeof data.totalTurns === 'number' ? data.totalTurns : 0,
    winTurns: typeof data.winTurns === 'number' ? data.winTurns : 0,
    currentWinStreak: typeof data.currentWinStreak === 'number' ? data.currentWinStreak : 0,
    closeCallCount: typeof data.closeCallCount === 'number' ? data.closeCallCount : 0,
    scoreDistribution:
      Array.isArray(data.scoreDistribution) && data.scoreDistribution.length === SCORE_BUCKETS
        ? data.scoreDistribution
        : createEmptyScoreDistribution(),
    matrix: data.matrix,
    winMatrix: isMatrix(data.winMatrix) ? data.winMatrix : createEmptyMatrix(),
    lossMatrix: isMatrix(data.lossMatrix) ? data.lossMatrix : createEmptyMatrix(),
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

  const recordCompletedGame = useCallback(
    (placements: Placement[], result: 'won' | 'lost', losingValue: number | null = null, total: number = BOARD_SIZE) => {
      setStats(prev => {
        const next = recordGame(prev, placements, result, losingValue, total)
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Storage unavailable (private browsing, quota, etc.) — stats just won't persist across reloads.
        }
        return next
      })
    },
    [],
  )

  return { stats, recordCompletedGame }
}
