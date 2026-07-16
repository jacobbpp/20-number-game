import { useCallback, useState } from 'react'

const STORAGE_KEY = 'order20-best-score'

function readStoredBest(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

export function useBestScore() {
  const [bestScore, setBestScore] = useState<number>(readStoredBest)

  const reportScore = useCallback((placedCount: number) => {
    setBestScore(prev => {
      if (placedCount <= prev) return prev
      window.localStorage.setItem(STORAGE_KEY, String(placedCount))
      return placedCount
    })
  }, [])

  return { bestScore, reportScore }
}
