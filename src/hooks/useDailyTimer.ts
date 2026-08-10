import { useCallback, useEffect, useRef, useState } from 'react'
import { IDLE_TIMER, isTimerState, pauseTimer, resumeFromStorage, startTimer, type TimerState } from '../game/dailyTimer'

const STORAGE_KEY = 'order20-daily-timer'

interface StoredDailyTimer {
  date: string
  timer: TimerState
}

function readTimer(today: string): TimerState {
  if (typeof window === 'undefined') return IDLE_TIMER
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return IDLE_TIMER
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return IDLE_TIMER
    const stored = parsed as Partial<StoredDailyTimer>
    // A timer from a previous day belongs to a different puzzle.
    if (stored.date !== today || !isTimerState(stored.timer)) return IDLE_TIMER
    // Whatever gap has passed since it was written is time the app was shut,
    // which nobody spent playing.
    return resumeFromStorage(stored.timer)
  } catch {
    return IDLE_TIMER
  }
}

// Measures how long today's daily actually took, as opposed to how long it sat
// open. The clock only runs while the app is in front of the player, so a
// locked phone or a switch to another app costs nothing.
export function useDailyTimer(today: string) {
  const [timer, setTimer] = useState<TimerState>(() => readTimer(today))
  // Whether the clock should be going when the app is visible. Deliberately
  // not persisted: after a refresh mid-run the clock waits for the next
  // placement rather than charging the player for time spent re-reading the
  // board.
  const runningRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, timer } satisfies StoredDailyTimer))
    } catch {
      // Storage unavailable — the time just won't survive a refresh.
    }
  }, [today, timer])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTimer(current => pauseTimer(current, Date.now()))
      } else if (runningRef.current) {
        setTimer(current => startTimer(current, Date.now()))
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Called on every daily placement. Starting an already-running clock is a
  // no-op, so the caller doesn't have to know whether this is the first move.
  const begin = useCallback(() => {
    runningRef.current = true
    setTimer(current => startTimer(current, Date.now()))
  }, [])

  // Called once the run is over. Returns the final time directly rather than
  // leaving the caller to read it back: the score is submitted in the same
  // tick, and a state update won't have landed by then.
  const finish = useCallback(() => {
    runningRef.current = false
    const stopped = pauseTimer(timer, Date.now())
    setTimer(stopped)
    return stopped.elapsedMs
  }, [timer])

  const reset = useCallback(() => {
    runningRef.current = false
    setTimer(IDLE_TIMER)
  }, [])

  return { timer, begin, finish, reset }
}
