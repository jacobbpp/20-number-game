import { describe, expect, it } from 'vitest'
import {
  IDLE_TIMER,
  currentElapsedMs,
  formatDuration,
  isTimerStarted,
  isTimerState,
  pauseTimer,
  resumeFromStorage,
  startTimer,
} from './dailyTimer'

const T0 = 1_000_000

describe('starting and pausing', () => {
  it('counts nothing before the first placement', () => {
    expect(currentElapsedMs(IDLE_TIMER, T0)).toBe(0)
    expect(isTimerStarted(IDLE_TIMER)).toBe(false)
  })

  it('counts from the moment it starts', () => {
    const running = startTimer(IDLE_TIMER, T0)

    expect(isTimerStarted(running)).toBe(true)
    expect(currentElapsedMs(running, T0 + 5_000)).toBe(5_000)
  })

  it('banks the stretch when it pauses, and stops counting', () => {
    const paused = pauseTimer(startTimer(IDLE_TIMER, T0), T0 + 5_000)

    expect(paused.elapsedMs).toBe(5_000)
    expect(paused.runningSince).toBeNull()
    // An hour spent away adds nothing.
    expect(currentElapsedMs(paused, T0 + 3_600_000)).toBe(5_000)
  })

  it('adds each stretch to the last, ignoring the gaps between', () => {
    let timer = startTimer(IDLE_TIMER, T0)
    timer = pauseTimer(timer, T0 + 4_000)
    // Phone locked for ten minutes.
    timer = startTimer(timer, T0 + 604_000)
    timer = pauseTimer(timer, T0 + 610_000)

    expect(timer.elapsedMs).toBe(10_000)
  })

  it('treats starting an already-running timer as nothing', () => {
    const running = startTimer(IDLE_TIMER, T0)

    // The app can fire "visible" while already in the foreground; that must
    // not reset the stretch in progress.
    expect(startTimer(running, T0 + 3_000)).toEqual(running)
    expect(currentElapsedMs(startTimer(running, T0 + 3_000), T0 + 5_000)).toBe(5_000)
  })

  it('treats pausing an already-paused timer as nothing', () => {
    const paused = pauseTimer(startTimer(IDLE_TIMER, T0), T0 + 4_000)

    expect(pauseTimer(paused, T0 + 9_000)).toEqual(paused)
  })

  it('never loses banked time if the device clock steps backwards', () => {
    let timer = startTimer(IDLE_TIMER, T0)
    timer = pauseTimer(timer, T0 + 6_000)
    timer = startTimer(timer, T0 + 6_000)

    // Clock jumps back mid-stretch. The stretch counts as zero rather than
    // subtracting from what was already banked.
    expect(currentElapsedMs(timer, T0 - 50_000)).toBe(6_000)
    expect(pauseTimer(timer, T0 - 50_000).elapsedMs).toBe(6_000)
  })
})

describe('resuming after the app was closed', () => {
  it('keeps what was banked but not the time the app was shut', () => {
    // Stored mid-run, then the app was closed for an hour.
    const stored = { elapsedMs: 12_000, runningSince: T0 }

    const resumed = resumeFromStorage(stored)

    expect(resumed.elapsedMs).toBe(12_000)
    expect(resumed.runningSince).toBeNull()
    expect(currentElapsedMs(resumed, T0 + 3_600_000)).toBe(12_000)
  })

  it('can be started again straight afterwards', () => {
    const resumed = startTimer(resumeFromStorage({ elapsedMs: 12_000, runningSince: T0 }), T0 + 3_600_000)

    expect(currentElapsedMs(resumed, T0 + 3_602_000)).toBe(14_000)
  })
})

describe('isTimerState', () => {
  it('accepts what the timer actually produces', () => {
    expect(isTimerState(IDLE_TIMER)).toBe(true)
    expect(isTimerState({ elapsedMs: 5_000, runningSince: T0 })).toBe(true)
  })

  it('rejects anything malformed, so bad storage falls back rather than throws', () => {
    expect(isTimerState(null)).toBe(false)
    expect(isTimerState({})).toBe(false)
    expect(isTimerState({ elapsedMs: 'five' })).toBe(false)
    expect(isTimerState({ elapsedMs: -1, runningSince: null })).toBe(false)
    expect(isTimerState({ elapsedMs: Number.NaN, runningSince: null })).toBe(false)
    expect(isTimerState({ elapsedMs: 1, runningSince: 'now' })).toBe(false)
  })
})

describe('formatDuration', () => {
  it('reads as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9_000)).toBe('0:09')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(134_000)).toBe('2:14')
  })

  it('keeps counting in minutes past an hour rather than growing a field', () => {
    expect(formatDuration(3_700_000)).toBe('61:40')
  })

  it('never shows a negative time', () => {
    expect(formatDuration(-5_000)).toBe('0:00')
  })
})
