import { useEffect, useState } from 'react'
import { isGameState, type GameState } from '../game/types'

const STORAGE_KEY = 'order20-current-daily-game'

interface StoredDailyGame {
  date: string
  state: GameState
}

function isStoredDailyGame(value: unknown): value is StoredDailyGame {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredDailyGame>
  return typeof candidate.date === 'string' && isGameState(candidate.state)
}

function readGame(today: string, expectedSize: number): GameState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredDailyGame(parsed)) return null
    // A persisted attempt from a previous day is a different puzzle
    // entirely (different board size, different roll sequence) — never
    // resume it as if it were today's.
    if (parsed.date !== today) return null
    // If today's own board size rotation ever changes (e.g. a size gets
    // added or removed from the curated set), a same-day in-progress game
    // created under the old mapping would otherwise keep resuming forever
    // — discard it and regenerate rather than resume a stale size.
    if (parsed.state.positions.length !== expectedSize) return null
    return parsed.state
  } catch {
    return null
  }
}

function writeGame(today: string, state: GameState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, state }))
  } catch {
    // Storage unavailable — today's progress just won't survive a refresh.
  }
}

// Persists today's in-progress daily attempt so a refresh resumes it
// instead of silently discarding it. No separate "already recorded"
// flag is needed here (unlike useCurrentGame) — todayResult from
// useDailyChallenge already serves that purpose once the attempt
// finishes, since it's read back from its own persisted key on mount.
export function useCurrentDailyGame(today: string, expectedSize: number, createInitial: () => GameState) {
  const [state, setState] = useState<GameState>(() => readGame(today, expectedSize) ?? createInitial())

  useEffect(() => {
    writeGame(today, state)
  }, [today, state])

  return [state, setState] as const
}
