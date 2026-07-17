import { useCallback, useState } from 'react'

export const BEST_SCORE_STORAGE_KEY = 'order20-best-score'
const STORAGE_KEY = BEST_SCORE_STORAGE_KEY
export const BEST_RUN_STORAGE_KEY = 'order20-best-run'

export interface BestRun {
  positions: (number | null)[]
  placedCount: number
  date: string
}

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

function isBestRun(value: unknown): value is BestRun {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BestRun>
  return Array.isArray(candidate.positions) && typeof candidate.placedCount === 'number' && typeof candidate.date === 'string'
}

function readStoredBestRun(): BestRun | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(BEST_RUN_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isBestRun(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function useBestScore() {
  const [bestScore, setBestScore] = useState<number>(readStoredBest)
  const [bestRun, setBestRun] = useState<BestRun | null>(readStoredBestRun)

  const reportScore = useCallback((placedCount: number, positions: (number | null)[]) => {
    setBestScore(prev => {
      if (placedCount <= prev) return prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(placedCount))
      } catch {
        // Storage unavailable (private browsing, quota, etc.) — keep the in-memory value.
      }

      const run: BestRun = { positions, placedCount, date: new Date().toISOString() }
      setBestRun(run)
      try {
        window.localStorage.setItem(BEST_RUN_STORAGE_KEY, JSON.stringify(run))
      } catch {
        // Storage unavailable — the board just won't be there to look back at.
      }

      return placedCount
    })
  }, [])

  return { bestScore, bestRun, reportScore }
}
