import { useCallback, useState } from 'react'
import {
  createEmptyStreak,
  getLocalDateString,
  recordDailyStreak,
  type StreakData,
} from '../game/daily'

const RESULT_STORAGE_KEY = 'order20-daily-result'
const STREAK_STORAGE_KEY = 'order20-daily-streak'

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

function readTodayResult(): DailyResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isDailyResult(parsed)) return null
    return parsed.date === getLocalDateString() ? parsed : null
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

export function useDailyChallenge() {
  const [todayResult, setTodayResult] = useState<DailyResult | null>(readTodayResult)
  const [streak, setStreak] = useState<StreakData>(readStreak)

  const recordDailyResult = useCallback((result: Omit<DailyResult, 'date'>) => {
    const date = getLocalDateString()
    const fullResult: DailyResult = { ...result, date }

    setTodayResult(fullResult)
    try {
      window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(fullResult))
    } catch {
      // Storage unavailable — the result just won't persist across reloads.
    }

    setStreak(prev => {
      const next = recordDailyStreak(prev, date)
      try {
        window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable — streak just won't persist across reloads.
      }
      return next
    })
  }, [])

  return { todayResult, streak, recordDailyResult }
}
