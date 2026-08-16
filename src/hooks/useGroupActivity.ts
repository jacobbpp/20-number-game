import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '../api'
import { getOrCreateDeviceId } from './useLeaderboard'
import type { FeedRun } from '../game/groupFeed'

// Mirrors the worker's own allowlist. Anything outside it is rejected there,
// so keeping the two in step is what stops the picker offering something the
// server will refuse.
export const REACTION_EMOJI = ['👏', '🔥', '😱', '😂'] as const

export interface FeedReaction {
  emoji: string
  count: number
}

export interface FeedEvent extends FeedRun {
  reactions: FeedReaction[]
  // What this device left, if anything. Worked out server side per viewer, so
  // no one else's device id ever reaches the client.
  myReaction: string | null
}

export interface GroupRecap {
  date: string
  games: number
  players: number
  busiestName: string | null
  busiestGames: number | null
  bestName: string | null
  bestScore: number | null
  bestBoardSize: number | null
}

export interface GroupFeed {
  events: FeedEvent[]
  // How many other people currently have the game open. Not "how many are
  // mid-game" — it counts open connections, which is the honest thing the
  // socket knows — and never the viewer's own.
  playing: number
  // False when running on the fetch fallback, so the UI can avoid claiming to
  // be live when it is really just a snapshot.
  live: boolean
}

const EMPTY_FEED: GroupFeed = { events: [], playing: 0, live: false }

// Long enough that a worker deploy or a flaky connection doesn't turn into a
// reconnect storm from every open tab at once.
const RECONNECT_DELAY_MS = 20_000

interface SnapshotPayload {
  events?: FeedEvent[]
  playing?: number
}

// Held open at the App level rather than inside the Stats screen. The count
// is meant to answer "who has the game open", so a socket that only existed
// while someone was looking at their stats would measure the wrong thing and
// almost always report nobody.
export type CommunityFeed = GroupFeed & {
  react: (eventId: number, emoji: string | null) => Promise<void>
}

export function useCommunityFeed(): CommunityFeed {
  const [feed, setFeed] = useState<GroupFeed>(EMPTY_FEED)
  // Set when running on the fallback, so a reaction can pull a fresh snapshot
  // itself rather than waiting for a broadcast that will never arrive.
  const refetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const deviceId = getOrCreateDeviceId()

    // Same snapshot, fetched once. Covers networks and browsers where a
    // WebSocket never opens — the panel is then merely not live, rather than
    // permanently empty.
    const loadOnce = () => {
      fetch(`${API_BASE}/activity?deviceId=${encodeURIComponent(deviceId)}`)
        .then(response => (response.ok ? (response.json() as Promise<SnapshotPayload>) : null))
        .then(data => {
          if (cancelled || !data) return
          setFeed({ events: data.events ?? [], playing: data.playing ?? 0, live: false })
        })
        .catch(() => {
          // Offline — the panel keeps whatever it last had.
        })
    }
    refetchRef.current = loadOnce

    const connect = () => {
      if (cancelled) return

      if (typeof WebSocket === 'undefined') {
        loadOnce()
        return
      }

      try {
        socket = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/activity?deviceId=${encodeURIComponent(deviceId)}`)
      } catch {
        loadOnce()
        return
      }

      socket.onmessage = message => {
        if (cancelled) return
        try {
          const data = JSON.parse(String(message.data)) as SnapshotPayload
          setFeed({ events: data.events ?? [], playing: data.playing ?? 0, live: true })
        } catch {
          // A malformed frame is not worth tearing the connection down for.
        }
      }

      socket.onerror = () => {
        if (!cancelled) loadOnce()
      }

      socket.onclose = () => {
        if (cancelled) return
        setFeed(previous => ({ ...previous, live: false, playing: 0 }))
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      cancelled = true
      refetchRef.current = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
      // Drop the handlers first: closing fires onclose, which would otherwise
      // queue a reconnect for a component that is already gone.
      if (socket) {
        socket.onclose = null
        socket.onerror = null
        socket.onmessage = null
        socket.close()
      }
    }
  }, [])

  // Posted over plain HTTP rather than up the socket, so it works the same
  // whether or not the live connection came up. The object broadcasts the
  // result, which is what actually updates the screen.
  const react = useCallback(async (eventId: number, emoji: string | null) => {
    try {
      const response = await fetch(`${API_BASE}/activity/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getOrCreateDeviceId(), eventId, emoji }),
      })
      // On the fallback there is no broadcast coming, so ask for the new state.
      if (response.ok) refetchRef.current?.()
    } catch {
      // Best effort: a failed reaction never affects the game.
    }
  }, [])

  return { ...feed, react }
}

interface RecapPayload {
  date?: string
  summary?: GroupRecap | null
}

// `loaded` distinguishes "still asking" from "asked, and there genuinely is
// no recap for that day yet" — the panel says different things for each, and
// before the first nightly run the second is the normal case.
export function useYesterdayRecap(today: string): { recap: GroupRecap | null; loaded: boolean } {
  const [recap, setRecap] = useState<GroupRecap | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/community/yesterday?today=${today}`)
      .then(response => (response.ok ? (response.json() as Promise<RecapPayload>) : null))
      .then(data => {
        if (cancelled) return
        setRecap(data?.summary ?? null)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [today])

  return { recap, loaded }
}
