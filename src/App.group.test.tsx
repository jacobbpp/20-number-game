import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// The group block only renders once the Stats screen has games behind it —
// with none, the screen shows its "play a full game" empty state instead.
function seedPlayedStats() {
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 1,
      totalWins: 0,
      totalTurns: 2,
      currentWinStreak: 0,
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      scoreDistribution: [1],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

interface MockRecap {
  games: number
  players: number
  busiestName?: string | null
  busiestGames?: number | null
  bestName?: string | null
  bestScore?: number | null
  bestBoardSize?: number | null
}

function mockApi(options: { recap?: MockRecap | null; activity?: unknown } = {}) {
  const { recap = null, activity = { events: [], playing: 0 } } = options
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/community/yesterday')) {
        const summary =
          recap === null
            ? null
            : { date: '2026-03-01', busiestName: null, busiestGames: null, bestName: null, bestScore: null, bestBoardSize: null, ...recap }
        return Promise.resolve(new Response(JSON.stringify({ date: '2026-03-01', summary }), { status: 200 }))
      }
      if (url.includes('/activity')) {
        return Promise.resolve(new Response(JSON.stringify(activity), { status: 200 }))
      }
      if (url.includes('/scores/check')) {
        return Promise.resolve(new Response(JSON.stringify({ windows: [] }), { status: 200 }))
      }
      if (url.includes('/scores/leaderboard')) {
        return Promise.resolve(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      }
      if (url.includes('/scores')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
    }),
  )
}

// Stands in for the live socket so a test can push a snapshot and assert on
// what the panel does with it. WebSocket itself is stubbed out globally in
// src/test/setup.ts to keep tests off the network.
interface DrivableSocket {
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  onclose: ((event: unknown) => void) | null
}

function captureSocket(): { current: DrivableSocket | null } {
  const ref: { current: DrivableSocket | null } = { current: null }
  class CapturingWebSocket implements DrivableSocket {
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    onclose: ((event: unknown) => void) | null = null
    constructor() {
      ref.current = this
    }
    send() {}
    close() {}
  }
  vi.stubGlobal('WebSocket', CapturingWebSocket)
  return ref
}

function pushSnapshot(socket: { current: DrivableSocket | null }, payload: unknown) {
  act(() => {
    socket.current?.onmessage?.({ data: JSON.stringify(payload) })
  })
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
  seedPlayedStats()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
})

describe('yesterday in the group', () => {
  it('shows the totals and names the busiest player and best run', async () => {
    mockApi({ recap: { games: 59, players: 6, busiestName: 'YRC', busiestGames: 46, bestName: 'SJW', bestScore: 15, bestBoardSize: 20 } })
    render(<App />)
    await openStats()

    expect(await screen.findByText('Yesterday in the group')).toBeInTheDocument()
    expect(screen.getByText('59')).toBeInTheDocument()
    expect(screen.getByText('games played')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('people played')).toBeInTheDocument()
    expect(screen.getByText(/Busiest was/)).toHaveTextContent('Busiest was YRC with 46 games. Best run was SJW on 15 of 20.')
  })

  it('explains itself rather than showing nothing before the first nightly run', async () => {
    mockApi({ recap: null })
    render(<App />)
    await openStats()

    expect(await screen.findByText("Yesterday's round-up hasn't run yet. It lands overnight.")).toBeInTheDocument()
  })

  it('says so plainly on a day nobody played', async () => {
    mockApi({ recap: { games: 0, players: 0 } })
    render(<App />)
    await openStats()

    expect(await screen.findByText('Nobody played yesterday.')).toBeInTheDocument()
  })

  it('uses singular wording for a single game by a single person', async () => {
    mockApi({ recap: { games: 1, players: 1, busiestName: 'JRC', busiestGames: 1, bestName: 'JRC', bestScore: 9, bestBoardSize: 20 } })
    render(<App />)
    await openStats()

    expect(await screen.findByText('game played')).toBeInTheDocument()
    expect(screen.getByText('person played')).toBeInTheDocument()
    expect(screen.getByText(/Busiest was/)).toHaveTextContent('with 1 game.')
  })
})

describe('recent activity feed', () => {
  it('renders games pushed over the socket, newest first', async () => {
    const socket = captureSocket()
    mockApi()
    render(<App />)
    await openStats()

    pushSnapshot(socket, {
      playing: 0,
      events: [
        { name: 'SJW', mode: 'daily', boardSize: 30, placedCount: 30, at: new Date().toISOString() },
        { name: 'JRC', mode: 'freeplay', boardSize: 20, placedCount: 8, at: new Date().toISOString() },
      ],
    })

    const rows = await screen.findAllByRole('listitem')
    const feedRows = rows.filter(row => row.className.includes('feed__row'))
    expect(feedRows).toHaveLength(2)
    expect(within(feedRows[0]).getByText('SJW')).toBeInTheDocument()
    expect(within(feedRows[0]).getByText('daily')).toBeInTheDocument()
    expect(within(feedRows[0]).getByText('30/30')).toBeInTheDocument()
    expect(within(feedRows[1]).getByText('JRC')).toBeInTheDocument()
    expect(within(feedRows[1]).getByText('free play')).toBeInTheDocument()
    expect(within(feedRows[1]).getByText('8/20')).toBeInTheDocument()
  })

  it('shows a game from a device that never saved a name as someone', async () => {
    const socket = captureSocket()
    mockApi()
    render(<App />)
    await openStats()

    pushSnapshot(socket, {
      playing: 0,
      events: [{ name: null, mode: 'freeplay', boardSize: 20, placedCount: 5, at: new Date().toISOString() }],
    })

    expect(await screen.findByText('someone')).toBeInTheDocument()
    expect(screen.getByText('5/20')).toBeInTheDocument()
  })

  it('counts people with the game open, without claiming they are mid-game', async () => {
    const socket = captureSocket()
    mockApi()
    render(<App />)
    await openStats()

    pushSnapshot(socket, { playing: 3, events: [] })
    expect(await screen.findByText('3 people have the game open.')).toBeInTheDocument()

    pushSnapshot(socket, { playing: 1, events: [] })
    expect(await screen.findByText('1 person has the game open.')).toBeInTheDocument()
  })

  it('says nothing about who is around when nobody is connected', async () => {
    const socket = captureSocket()
    mockApi()
    render(<App />)
    await openStats()

    pushSnapshot(socket, { playing: 0, events: [] })

    expect(await screen.findByText('No games finished recently.')).toBeInTheDocument()
    expect(screen.queryByText(/have the game open/)).not.toBeInTheDocument()
    expect(screen.queryByText(/has the game open/)).not.toBeInTheDocument()
  })

  it('falls back to a plain fetch when the socket errors, so the panel still fills', async () => {
    const socket = captureSocket()
    mockApi({
      activity: {
        playing: 0,
        events: [{ name: 'ALR', mode: 'freeplay', boardSize: 20, placedCount: 11, at: new Date().toISOString() }],
      },
    })
    render(<App />)
    await openStats()

    await act(async () => {
      socket.current?.onerror?.(new Event('error'))
    })

    expect(await screen.findByText('ALR')).toBeInTheDocument()
    expect(screen.getByText('11/20')).toBeInTheDocument()
  })
})
