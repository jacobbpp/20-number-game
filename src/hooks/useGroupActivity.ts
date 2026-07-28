import { useEffect, useState } from 'react'
import { API_BASE } from '../api'

export interface FeedEvent {
  name: string | null
  mode: string
  boardSize: number
  placedCount: number
  at: string
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
  // How many people currently have the game open. Not "how many are mid-game"
  // — it counts open connections, which is the honest thing the socket knows.
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
export function useCommunityFeed(): GroupFeed {
  const [feed, setFeed] = useState<GroupFeed>(EMPTY_FEED)

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    // Same snapshot, fetched once. Covers networks and browsers where a
    // WebSocket never opens — the panel is then merely not live, rather than
    // permanently empty.
    const loadOnce = () => {
      fetch(`${API_BASE}/activity`)
        .then(response => (response.ok ? (response.json() as Promise<SnapshotPayload>) : null))
        .then(data => {
          if (cancelled || !data) return
          setFeed({ events: data.events ?? [], playing: data.playing ?? 0, live: false })
        })
        .catch(() => {
          // Offline — the panel keeps whatever it last had.
        })
    }

    const connect = () => {
      if (cancelled) return

      if (typeof WebSocket === 'undefined') {
        loadOnce()
        return
      }

      try {
        socket = new WebSocket(`${API_BASE.replace(/^http/, 'ws')}/activity`)
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

  return feed
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
