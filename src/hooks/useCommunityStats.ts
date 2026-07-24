import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { bucketForValue, createEmptyMatrix, type Placement } from '../game/stats'
import { BOARD_SIZE } from '../game/types'

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
    fetch(`${API_BASE}/placements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardSize: BOARD_SIZE,
        placements: placements.map(p => ({ position: p.position, valueBucket: bucketForValue(p.value) })),
      }),
    }).catch(() => {
      // Best-effort — a failed report never affects gameplay.
    })
  }, [])

  // A bare (date, mode, boardSize) counter, separate from placements/scores
  // on purpose — neither of those can answer "how many games happened on a
  // given day," since placements only covers free play with no date at all,
  // and scores/daily_scores only capture top-10 saves. One call per
  // completed game, win or lose, both modes.
  const reportActivity = useCallback((date: string, mode: 'freeplay' | 'daily', boardSize: number) => {
    fetch(`${API_BASE}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, mode, boardSize }),
    }).catch(() => {
      // Best-effort — a failed report never affects gameplay.
    })
  }, [])

  return { matrix, reportPlacements, reportActivity }
}
