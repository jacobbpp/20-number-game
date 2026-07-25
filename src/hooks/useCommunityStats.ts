import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { bucketForValue, createEmptyMatrix, type Placement } from '../game/stats'
import { BOARD_SIZE } from '../game/types'
import { getOrCreateDeviceId } from './useLeaderboard'

interface SummaryResponse {
  matrix?: number[][]
}

// Free-play placements only, mirroring the personal history this replaced:
// daily board sizes vary, so "position 5" doesn't mean the same thing from
// one day to the next, community or not.
export function useCommunityStats() {
  const [matrix, setMatrix] = useState<number[][]>(createEmptyMatrix)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/placements/summary?boardSize=${BOARD_SIZE}`)
      .then(response => (response.ok ? (response.json() as Promise<SummaryResponse>) : null))
      .then(data => {
        if (!cancelled && data?.matrix) setMatrix(data.matrix)
      })
      .catch(() => {
        // Offline or the API is unreachable — the dot just won't show
        // anything new until the next successful fetch.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reportPlacements = useCallback((placements: Placement[]) => {
    if (placements.length === 0) return
    const deviceId = getOrCreateDeviceId()
    fetch(`${API_BASE}/placements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardSize: BOARD_SIZE,
        placements: placements.map(p => ({ position: p.position, valueBucket: bucketForValue(p.value) })),
        deviceId,
      }),
    }).catch(() => {
      // Best-effort — a failed report never affects gameplay.
    })
  }, [])

  // One row per completed game, win or lose, both modes — tied to this
  // device's id (shared with the streak leaderboard) so a per-device
  // breakdown (games today, how far they got, vs. yesterday) can be built
  // later. Neither placements nor scores/daily_scores can answer that:
  // placements has no date, and scores only capture qualifying top-10 saves.
  const reportGame = useCallback((name: string, date: string, mode: 'freeplay' | 'daily', boardSize: number, placedCount: number) => {
    const deviceId = getOrCreateDeviceId()
    fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, name: name || null, date, mode, boardSize, placedCount }),
    }).catch(() => {
      // Best-effort — a failed report never affects gameplay.
    })
  }, [])

  return { matrix, reportPlacements, reportGame }
}
