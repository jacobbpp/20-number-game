import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress, type PressEvent } from './useLongPress'

const HOLD_MS = 3000

const capture = vi.fn()

function press(x = 100, y = 100): PressEvent {
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { setPointerCapture: capture, releasePointerCapture: vi.fn() },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  capture.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(onComplete = vi.fn(), onStart = vi.fn()) {
  const view = renderHook(() => useLongPress({ durationMs: HOLD_MS, onStart, onComplete }))
  return { ...view, onComplete, onStart }
}

describe('holding it down', () => {
  it('fires once the hold is long enough', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    expect(onComplete).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(HOLD_MS))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('does not fire early', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(HOLD_MS - 100))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('reports progress as it goes, which is the only clue there is', () => {
    const { result } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    expect(result.current.progress).toBe(0)

    act(() => void vi.advanceTimersByTime(HOLD_MS / 2))
    expect(result.current.progress).toBeGreaterThan(0.4)
    expect(result.current.progress).toBeLessThan(0.6)
  })

  it('fires the start callback immediately, so a fetch can run during the hold', () => {
    const { result, onStart } = setup()

    act(() => result.current.handlers.onPointerDown(press()))

    expect(onStart).toHaveBeenCalledOnce()
  })

  it('captures the pointer, so the events keep coming if the finger strays', () => {
    const { result } = setup()

    act(() => result.current.handlers.onPointerDown(press()))

    expect(capture).toHaveBeenCalledWith(1)
  })

  it('only fires once however long it is held', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(HOLD_MS * 4))

    expect(onComplete).toHaveBeenCalledOnce()
  })
})

describe('a finger that will not sit still', () => {
  // The whole reason this hook was reworked. Holding a phone perfectly steady
  // for three seconds is not a thing anybody does, and cancelling on the
  // first pixel of drift meant the hold never completed on a real device.
  it('tolerates the wobble of an ordinary hold', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press(100, 100)))
    act(() => void vi.advanceTimersByTime(1000))
    act(() => result.current.handlers.onPointerMove(press(104, 97)))
    act(() => void vi.advanceTimersByTime(1000))
    act(() => result.current.handlers.onPointerMove(press(98, 106)))
    act(() => void vi.advanceTimersByTime(1200))

    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('gives up on a deliberate swipe', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press(100, 100)))
    act(() => void vi.advanceTimersByTime(500))
    act(() => result.current.handlers.onPointerMove(press(100, 160)))
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
    expect(result.current.progress).toBe(0)
  })

  it('measures drift from where the finger started, not from the last move', () => {
    // Otherwise a slow scroll of a few pixels at a time never trips the
    // threshold and the hold completes in the middle of a swipe.
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press(100, 100)))
    for (const y of [104, 108, 112, 116, 120]) {
      act(() => result.current.handlers.onPointerMove(press(100, y)))
    }
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('ignores movement when nothing is being held', () => {
    const { result } = setup()

    expect(() => result.current.handlers.onPointerMove(press(400, 400))).not.toThrow()
  })
})

describe('letting go early', () => {
  it('cancels on release', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerUp())
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
    expect(result.current.progress).toBe(0)
  })

  it('cancels when the browser takes the gesture over', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerCancel())
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('starts from nothing on the next attempt rather than carrying on', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerUp())

    act(() => result.current.handlers.onPointerDown(press()))
    act(() => void vi.advanceTimersByTime(300))

    expect(onComplete).not.toHaveBeenCalled()
  })
})

describe('tidying up', () => {
  it('stops ticking when whatever was being held goes away', () => {
    const { result, unmount, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown(press()))
    unmount()
    act(() => void vi.advanceTimersByTime(HOLD_MS * 2))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('copes with a browser that has no pointer capture', () => {
    const { result, onComplete } = setup()

    act(() =>
      result.current.handlers.onPointerDown({ clientX: 0, clientY: 0, pointerId: 1, currentTarget: {} }),
    )
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('swallows the long-press callout so it cannot cover what is being held', () => {
    const { result } = setup()
    const preventDefault = vi.fn()

    result.current.handlers.onContextMenu({ preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
  })
})
