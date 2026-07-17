import { useCallback, useState } from 'react'
import { createEmptyStreak, recordDailyStreak, type StreakData } from '../game/daily'

const RESULT_STORAGE_KEY = 'order20-daily-result'
const STREAK_STORAGE_KEY = 'order20-daily-streak'
const HISTORY_STORAGE_KEY = 'order20-daily-history'
const HISTORY_LIMIT = 30

export interface DailyResult {
  date: string
  positions: (number | null)[]
  placedCount: number
  status: 'won' | 'lost'
  lossReason: string | null
}

function isDailyResult(value: unknown): value is DailyResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DailyResult>
  return typeof candidate.date === 'string' && Array.isArray(candidate.positions) && typeof candidate.placedCount === 'number'
}

function isStreakData(value: unknown): value is StreakData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StreakData>
  return typeof candidate.count === 'number'
}

function readTodayResult(today: string): DailyResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isDailyResult(parsed)) return null
    return parsed.date === today ? parsed : null
  } catch {
    return null
  }
}

function readStreak(): StreakData {
  if (typeof window === 'undefined') return createEmptyStreak()
  try {
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY)
    if (!raw) return createEmptyStreak()
    const parsed: unknown = JSON.parse(raw)
    return isStreakData(parsed) ? parsed : createEmptyStreak()
  } catch {
    return createEmptyStreak()
  }
}

function readHistory(): DailyResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDailyResult)
  } catch {
    return []
  }
}

// `today` must be a single date frozen once per session by the caller (see
// App.tsx's dailyDateRef) rather than re-derived from `new Date()` on every
// call — otherwise a session left open across a real midnight would silently
// disagree with itself about what day it is.
export function useDailyChallenge(today: string) {
  const [todayResult, setTodayResult] = useState<DailyResult | null>(() => readTodayResult(today))
  const [streak, setStreak] = useState<StreakData>(readStreak)
  const [history, setHistory] = useState<DailyResult[]>(readHistory)

  const recordDailyResult = useCallback(
    (result: Omit<DailyResult, 'date'>) => {
      const fullResult: DailyResult = { ...result, date: today }

      setTodayResult(fullResult)
      try {
        window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(fullResult))
      } catch {
        // Storage unavailable — the result just won't persist across reloads.
      }

      setStreak(prev => {
        const next = recordDailyStreak(prev, today)
        try {
          window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Storage unavailable — streak just won't persist across reloads.
        }
        return next
      })

      setHistory(prev => {
        // Dedupe by date as cheap insurance against a double-fire, same
        // spirit as the todayResult guard in App.tsx's recording effect.
        const next = [fullResult, ...prev.filter(entry => entry.date !== today)].slice(0, HISTORY_LIMIT)
        try {
          window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // Storage unavailable — history just won't persist across reloads.
        }
        return next
      })
    },
    [today],
  )

  return { todayResult, streak, history, recordDailyResult }
}
