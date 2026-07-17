import { useCallback, useState } from 'react'

export const BEST_SCORE_STORAGE_KEY = 'order20-best-score'
const STORAGE_KEY = BEST_SCORE_STORAGE_KEY

function readStoredBest(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

export function useBestScore() {
  const [bestScore, setBestScore] = useState<number>(readStoredBest)

  const reportScore = useCallback((placedCount: number) => {
    setBestScore(prev => {
      if (placedCount <= prev) return prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(placedCount))
      } catch {
        // Storage unavailable (private browsing, quota, etc.) — keep the in-memory value.
      }
      return placedCount
    })
  }, [])

  return { bestScore, reportScore }
}
