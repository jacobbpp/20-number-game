import { useCallback, useEffect, useState } from 'react'
import { roll } from '../game/engine'
import { createInitialState, isGameState, type GameState } from '../game/types'

const STORAGE_KEY = 'order20-current-game'
const RECORDED_STORAGE_KEY = 'order20-current-game-recorded'

function readGame(): GameState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isGameState(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeGame(state: GameState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — progress just won't survive a refresh.
  }
}

function readRecorded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RECORDED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeRecorded(recorded: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (recorded) window.localStorage.setItem(RECORDED_STORAGE_KEY, '1')
    else window.localStorage.removeItem(RECORDED_STORAGE_KEY)
  } catch {
    // Storage unavailable — a refresh right after finishing could
    // double-record the same game into stats/best score.
  }
}

function startFreshGame(): GameState {
  return roll(createInitialState())
}

// Persists the in-progress free-play game to localStorage so a refresh
// resumes exactly where you left off instead of silently discarding it.
//
// hasRecorded is separate, persisted state (not derived from `state`
// itself) because a completed game (status won/lost) restored after a
// refresh must NOT re-trigger the win/loss recording effect — without
// this, every refresh of a finished game would double-count it into
// stats and best score.
export function useCurrentGame() {
  const [state, setState] = useState<GameState>(() => readGame() ?? startFreshGame())
  const [hasRecorded, setHasRecordedState] = useState<boolean>(readRecorded)

  useEffect(() => {
    writeGame(state)
  }, [state])

  const setHasRecorded = useCallback((recorded: boolean) => {
    setHasRecordedState(recorded)
    writeRecorded(recorded)
  }, [])

  const restart = useCallback(() => {
    setState(startFreshGame())
    setHasRecorded(false)
  }, [setHasRecorded])

  return { state, setState, hasRecorded, setHasRecorded, restart }
}
