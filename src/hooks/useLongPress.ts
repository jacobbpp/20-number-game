import { useCallback, useEffect, useRef, useState } from 'react'

// A press-and-hold, used for exactly one thing: the way into Order 6.
//
// Progress is reported back so the thing being held can fill up as you hold
// it. That is the only clue the easter egg gets — nothing labels it, but a
// hold that started by accident visibly does something, which is enough to
// make it findable without giving it away.

const TICK_MS = 40

// How far a finger may wander before the hold is treated as a swipe. Nobody
// holds a phone perfectly still for three seconds, and cancelling on the
// first pixel of drift means the hold never completes on a real device.
const DRIFT_TOLERANCE_PX = 14

// The parts of a pointer event this needs, so a test can hand it a plain
// object rather than construct a real one.
export interface PressEvent {
  clientX: number
  clientY: number
  pointerId: number
  currentTarget: {
    setPointerCapture?: (pointerId: number) => void
    releasePointerCapture?: (pointerId: number) => void
  }
}

export interface LongPressOptions {
  durationMs: number
  // Fired the moment the press begins, before it has been held long enough.
  // The reveal uses it to start fetching the numbers it will need, so the
  // hold doubles as the loading window.
  onStart?: () => void
  onComplete: () => void
}

export interface LongPress {
  // 0 to 1. Zero whenever nothing is being held.
  progress: number
  handlers: {
    onPointerDown: (event: PressEvent) => void
    onPointerMove: (event: PressEvent) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onContextMenu: (event: { preventDefault: () => void }) => void
  }
}

export function useLongPress({ durationMs, onStart, onComplete }: LongPressOptions): LongPress {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const originRef = useRef<{ x: number; y: number } | null>(null)

  // Held in refs so starting a press never depends on a fresh callback
  // identity, which would restart the interval mid-hold.
  const completeRef = useRef(onComplete)
  const startRef = useRef(onStart)
  useEffect(() => {
    completeRef.current = onComplete
    startRef.current = onStart
  })

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    elapsedRef.current = 0
    originRef.current = null
    setProgress(0)
  }, [])

  // Nothing should keep ticking after the thing being held has gone away.
  useEffect(() => stop, [stop])

  const begin = useCallback(
    (event: PressEvent) => {
      if (timerRef.current !== null) return

      originRef.current = { x: event.clientX, y: event.clientY }
      // Keeps the events coming to this element even if the finger strays off
      // it, which is what pointerleave used to misread as letting go.
      event.currentTarget.setPointerCapture?.(event.pointerId)

      elapsedRef.current = 0
      startRef.current?.()

      timerRef.current = setInterval(() => {
        elapsedRef.current += TICK_MS
        const next = Math.min(1, elapsedRef.current / durationMs)
        setProgress(next)

        if (next >= 1) {
          stop()
          completeRef.current()
        }
      }, TICK_MS)
    },
    [durationMs, stop],
  )

  // Only a deliberate swipe should call it off. This used to cancel on
  // pointerleave, which a finger crosses within a pixel or two of drift.
  const track = useCallback(
    (event: PressEvent) => {
      const origin = originRef.current
      if (!origin) return

      const drift = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
      if (drift > DRIFT_TOLERANCE_PX) stop()
    },
    [stop],
  )

  return {
    progress,
    handlers: {
      onPointerDown: begin,
      onPointerMove: track,
      onPointerUp: stop,
      // Fires when the browser takes the gesture over for itself, which
      // touch-action: none on the element is there to prevent.
      onPointerCancel: stop,
      // A long press on touch otherwise raises the text-selection callout
      // over the top of what is being held.
      onContextMenu: event => event.preventDefault(),
    },
  }
}
