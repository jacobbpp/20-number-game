import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

const HOLD_MS = 3000

beforeEach(() => {
  vi.useFakeTimers()
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

    act(() => result.current.handlers.onPointerDown())
    expect(onComplete).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(HOLD_MS))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('does not fire early', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(HOLD_MS - 100))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('reports progress as it goes, which is the only clue there is', () => {
    const { result } = setup()

    act(() => result.current.handlers.onPointerDown())
    expect(result.current.progress).toBe(0)

    act(() => void vi.advanceTimersByTime(HOLD_MS / 2))
    expect(result.current.progress).toBeGreaterThan(0.4)
    expect(result.current.progress).toBeLessThan(0.6)
  })

  it('fires the start callback immediately, so a fetch can run during the hold', () => {
    const { result, onStart } = setup()

    act(() => result.current.handlers.onPointerDown())

    expect(onStart).toHaveBeenCalledOnce()
  })

  it('only fires once however long it is held', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(HOLD_MS * 4))

    expect(onComplete).toHaveBeenCalledOnce()
  })
})

describe('letting go early', () => {
  it('cancels on release', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerUp())
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
    expect(result.current.progress).toBe(0)
  })

  it('cancels when a finger slides off it', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerLeave())
    act(() => void vi.advanceTimersByTime(HOLD_MS))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('starts from nothing on the next attempt rather than carrying on', () => {
    const { result, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(HOLD_MS - 200))
    act(() => result.current.handlers.onPointerUp())

    act(() => result.current.handlers.onPointerDown())
    act(() => void vi.advanceTimersByTime(300))

    expect(onComplete).not.toHaveBeenCalled()
  })
})

describe('tidying up', () => {
  it('stops ticking when whatever was being held goes away', () => {
    const { result, unmount, onComplete } = setup()

    act(() => result.current.handlers.onPointerDown())
    unmount()
    act(() => void vi.advanceTimersByTime(HOLD_MS * 2))

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('swallows the long-press callout so it cannot cover what is being held', () => {
    const { result } = setup()
    const preventDefault = vi.fn()

    result.current.handlers.onContextMenu({ preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
  })
})
