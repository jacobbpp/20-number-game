// Time spent actually playing today's daily, as opposed to wall-clock time
// between opening it and finishing. The difference matters: the daily resumes
// across a refresh and people put their phone down mid-run, so elapsed real
// time would mostly measure interruptions rather than how quickly someone
// solved it.
//
// Kept pure and clock-injected so the whole thing is testable without waiting.
export interface TimerState {
  // Milliseconds banked from stretches that have already ended.
  elapsedMs: number
  // When the current running stretch began, or null when paused, not yet
  // started, or finished.
  runningSince: number | null
}

export const IDLE_TIMER: TimerState = { elapsedMs: 0, runningSince: null }

export function isTimerStarted(timer: TimerState): boolean {
  return timer.elapsedMs > 0 || timer.runningSince !== null
}

// Called on the first placement, and again whenever the app comes back to the
// foreground. Starting an already-running timer is a no-op rather than an
// error, so callers don't have to track which it is.
export function startTimer(timer: TimerState, nowMs: number): TimerState {
  if (timer.runningSince !== null) return timer
  return { ...timer, runningSince: nowMs }
}

// Called when the app goes to the background and when the run ends. Banks the
// stretch that just finished.
export function pauseTimer(timer: TimerState, nowMs: number): TimerState {
  if (timer.runningSince === null) return timer
  // Clamped at zero: a device clock that steps backwards mid-run would
  // otherwise subtract time already banked.
  const stretch = Math.max(0, nowMs - timer.runningSince)
  return { elapsedMs: timer.elapsedMs + stretch, runningSince: null }
}

export function currentElapsedMs(timer: TimerState, nowMs: number): number {
  if (timer.runningSince === null) return timer.elapsedMs
  return timer.elapsedMs + Math.max(0, nowMs - timer.runningSince)
}

// A timer restored from storage may claim to be running, but the gap since
// then is time the app was closed and nobody was playing. Bank what was
// already counted and leave it paused; the caller restarts it if the run is
// still going and the app is visible.
export function resumeFromStorage(timer: TimerState): TimerState {
  return { elapsedMs: timer.elapsedMs, runningSince: null }
}

export function isTimerState(value: unknown): value is TimerState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TimerState>
  if (typeof candidate.elapsedMs !== 'number' || !Number.isFinite(candidate.elapsedMs) || candidate.elapsedMs < 0) return false
  return candidate.runningSince === null || typeof candidate.runningSince === 'number'
}

// Minutes and seconds, since a daily run is a couple of minutes rather than
// hours. Anything past an hour keeps counting in minutes rather than growing
// an hours field nobody will ever need.
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}
