import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCommunityFeed, useYesterdayRecap } from './useGroupActivity'

interface FakeSocket {
  url: string
  closed: boolean
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: unknown) => void) | null
}

// Records every socket the hook constructs, so a test can assert on whether a
// reconnect happened rather than on timers firing.
function trackSockets(): FakeSocket[] {
  const sockets: FakeSocket[] = []

  class TrackedWebSocket implements FakeSocket {
    url: string
    closed = false
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onclose: ((event: unknown) => void) | null = null

    constructor(url: string) {
      this.url = url
      sockets.push(this)
    }

    send() {}

    close() {
      this.closed = true
      // A real socket fires its close handler on close. The hook is expected
      // to have detached its handlers first, so this must not queue anything.
      this.onclose?.({})
    }
  }

  vi.stubGlobal('WebSocket', TrackedWebSocket)
  return sockets
}

const RECONNECT_DELAY_MS = 20_000

// Fake timers are opt-in per test rather than global: testing-library's
// waitFor polls on real timers, so the fetch-fallback tests hang forever if
// the clock is frozen underneath them.
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCommunityFeed', () => {
  it('opens a websocket to the activity endpoint on mount', () => {
    const sockets = trackSockets()
    renderHook(() => useCommunityFeed())

    expect(sockets).toHaveLength(1)
    expect(sockets[0].url).toMatch(/^wss:\/\/.+\/activity$/)
  })

  it('applies a pushed snapshot', () => {
    const sockets = trackSockets()
    const { result } = renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onmessage?.({
        data: JSON.stringify({ playing: 3, events: [{ name: 'YRC', mode: 'freeplay', boardSize: 20, placedCount: 14, at: '2026-03-01T12:00:00Z' }] }),
      })
    })

    expect(result.current.playing).toBe(3)
    expect(result.current.events).toHaveLength(1)
    expect(result.current.live).toBe(true)
  })

  it('survives a malformed frame without losing what it already had', () => {
    const sockets = trackSockets()
    const { result } = renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onmessage?.({ data: JSON.stringify({ playing: 2, events: [] }) })
    })
    act(() => {
      sockets[0].onmessage?.({ data: 'not json at all' })
    })

    expect(result.current.playing).toBe(2)
    expect(result.current.live).toBe(true)
  })

  it('stops claiming to be live, and drops the stale count, when the socket closes', () => {
    const sockets = trackSockets()
    const { result } = renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onmessage?.({ data: JSON.stringify({ playing: 4, events: [] }) })
    })
    expect(result.current.live).toBe(true)

    act(() => {
      sockets[0].onclose?.({})
    })

    // Showing "4 people have the game open" off a dead socket would be a
    // number the app can no longer stand behind.
    expect(result.current.live).toBe(false)
    expect(result.current.playing).toBe(0)
  })

  it('reconnects after the backoff delay', () => {
    vi.useFakeTimers()
    const sockets = trackSockets()
    renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onclose?.({})
    })
    expect(sockets).toHaveLength(1)

    // Nothing before the delay is up.
    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAY_MS - 1)
    })
    expect(sockets).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(sockets).toHaveLength(2)
  })

  it('keeps reconnecting if the replacement socket also drops', () => {
    vi.useFakeTimers()
    const sockets = trackSockets()
    renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onclose?.({})
      vi.advanceTimersByTime(RECONNECT_DELAY_MS)
    })
    act(() => {
      sockets[1].onclose?.({})
      vi.advanceTimersByTime(RECONNECT_DELAY_MS)
    })

    expect(sockets).toHaveLength(3)
  })

  it('does not reconnect after unmount', () => {
    vi.useFakeTimers()
    const sockets = trackSockets()
    const { unmount } = renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onclose?.({})
    })
    unmount()

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAY_MS * 3)
    })

    // The pending reconnect timer has to be cleared on unmount, or every
    // screen the player passes through leaves a socket dialling forever.
    expect(sockets).toHaveLength(1)
  })

  it('closes the socket on unmount without that close queueing a reconnect', () => {
    vi.useFakeTimers()
    const sockets = trackSockets()
    const { unmount } = renderHook(() => useCommunityFeed())

    unmount()

    expect(sockets[0].closed).toBe(true)

    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAY_MS * 3)
    })

    // close() fires onclose. If the hook had not detached its handlers first,
    // its own cleanup would have scheduled the reconnect it was trying to
    // prevent.
    expect(sockets).toHaveLength(1)
  })

  it('falls back to a plain fetch where WebSocket does not exist', async () => {
    vi.stubGlobal('WebSocket', undefined)
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ playing: 0, events: [{ name: 'ALR', mode: 'daily', boardSize: 15, placedCount: 9, at: '2026-03-01T12:00:00Z' }] }), {
          status: 200,
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCommunityFeed())

    await waitFor(() => expect(result.current.events).toHaveLength(1))
    expect(result.current.events[0].name).toBe('ALR')
    // Fetched, not streamed, so it must not present itself as live.
    expect(result.current.live).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/activity$/))
  })

  it('falls back to a plain fetch when the socket errors', async () => {
    const sockets = trackSockets()
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ playing: 0, events: [] }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useCommunityFeed())

    act(() => {
      sockets[0].onerror?.({})
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})

describe('useYesterdayRecap', () => {
  it('reports loaded with a null recap when the day has no summary yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ date: '2026-02-28', summary: null }), { status: 200 }))),
    )

    const { result } = renderHook(() => useYesterdayRecap('2026-03-01'))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.recap).toBeNull()
  })

  it('still reports loaded when the request fails outright', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )

    const { result } = renderHook(() => useYesterdayRecap('2026-03-01'))

    // Otherwise the panel sits on "Fetching yesterday." forever with no way
    // of knowing the request already failed.
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.recap).toBeNull()
  })

  it('asks for the day the caller thinks it is', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ date: '2026-02-28', summary: null }), { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useYesterdayRecap('2026-03-01'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('today=2026-03-01')))
  })
})
