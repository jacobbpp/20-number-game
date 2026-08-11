import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

const HOLD_MS = 3000

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function mockApi(record: { games: number; players: number; wins: number } | 'down' = { games: 644, players: 9, wins: 0 }) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (url.includes('/community/record')) {
      if (record === 'down') return Promise.reject(new Error('offline'))
      return Promise.resolve(new Response(JSON.stringify(record), { status: 200 }))
    }
    if (url.includes('/community/yesterday')) {
      return Promise.resolve(new Response(JSON.stringify({ date: '2026-08-09', summary: null }), { status: 200 }))
    }
    if (url.includes('/activity')) {
      return Promise.resolve(new Response(JSON.stringify({ events: [], playing: 0 }), { status: 200 }))
    }
    if (url.includes('/scores/check') || url.includes('/daily-scores/check')) {
      return Promise.resolve(new Response(JSON.stringify({ windows: [], qualifies: false }), { status: 200 }))
    }
    if (url.includes('/scores') || url.includes('/games') || url.includes('/placements') || url.includes('/streaks')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Needed only by the tests that visit Stats: that screen shows nothing but
// "play a full game" until there is a game behind it. The egg itself is on
// the game header, so it is reachable from the first second.
function seedOneFinishedGame() {
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 1,
      totalWins: 0,
      totalTurns: 9,
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

// The wordmark in the game header. Deliberately not a button and carrying no
// name that hints at it, so there is nothing to query by role: finding it by
// its text is the test paying the same price a player does.
function wordmark(): HTMLElement {
  const name = screen.getByText('order-20')
  const mark = name.parentElement
  if (!mark) throw new Error('the wordmark has no wrapper around it')
  return mark
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

// A real finger drifts a few pixels over three seconds, which is exactly what
// used to cancel the hold on a phone. The wobble here is deliberate.
async function holdWordmark(ms = HOLD_MS, drift = 6) {
  const mark = wordmark()
  fireEvent.pointerDown(mark, { clientX: 100, clientY: 100, pointerId: 1 })
  await act(async () => {
    vi.advanceTimersByTime(ms / 2)
  })
  fireEvent.pointerMove(mark, { clientX: 100 + drift, clientY: 100 - drift, pointerId: 1 })
  await act(async () => {
    vi.advanceTimersByTime(ms / 2 + 100)
  })
  fireEvent.pointerUp(mark)
}

// Plays the short board until it ends, whichever way it goes. A six slot
// board finishes fast; the cap only stops a bug turning into a hung test.
async function playShortBoardToTheEnd() {
  for (let move = 0; move < 40; move++) {
    const slots = screen.queryAllByRole('button', { name: /empty, valid placement/ })
    if (slots.length === 0) break
    fireEvent.click(slots[0])
    if (screen.queryByText(/of 6$/)) break
  }
  await screen.findByText(/of 6$/)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
  seedOneFinishedGame()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('before it has been found', () => {
  it('says nothing about Order 6 anywhere', async () => {
    mockApi()
    render(<App />)

    // Not on the game screen it hides on...
    expect(screen.queryByText(/Order 6/)).not.toBeInTheDocument()
    await openStats()
    // ...nor anywhere in the menu that leads back to it later.
    expect(screen.queryByText(/Order 6/)).not.toBeInTheDocument()
  })

  it('ignores an ordinary tap on the wordmark', async () => {
    mockApi()
    render(<App />)

    fireEvent.pointerDown(wordmark())
    fireEvent.pointerUp(wordmark())
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(screen.queryByText(/Order 6/)).not.toBeInTheDocument()
  })

  it('ignores a hold that is let go too early', async () => {
    mockApi()
    render(<App />)

    const tile = wordmark()
    fireEvent.pointerDown(tile)
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS - 400)
    })
    fireEvent.pointerUp(tile)
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS)
    })

    expect(screen.queryByText(/Order 6/)).not.toBeInTheDocument()
  })
})

describe('finding it', () => {
  it('opens the reveal after a long enough hold', async () => {
    mockApi()
    render(<App />)
    await holdWordmark()

    expect(await screen.findByText('Nobody has ever won')).toBeInTheDocument()
  })

  it('quotes the real numbers rather than any that were written down', async () => {
    mockApi({ games: 1204, players: 11, wins: 0 })
    render(<App />)
    await holdWordmark()

    expect(await screen.findByText(/1,204 games counted between 11 of you/)).toBeInTheDocument()
  })

  it('changes what it claims once somebody has actually won', async () => {
    mockApi({ games: 3140, players: 9, wins: 1 })
    render(<App />)
    await holdWordmark()

    expect(await screen.findByText('It has happened. Once.')).toBeInTheDocument()
    expect(screen.queryByText('Nobody has ever won')).not.toBeInTheDocument()
  })

  it('still opens when the worker cannot be reached', async () => {
    mockApi('down')
    render(<App />)
    await holdWordmark()

    expect(await screen.findByText('You have never won')).toBeInTheDocument()
  })

  it('stays found across a reload', async () => {
    mockApi()
    render(<App />)
    await holdWordmark()
    await screen.findByText('Nobody has ever won')

    cleanup()
    render(<App />)
    await openStats()

    expect(await screen.findByRole('button', { name: /Order 6/ })).toBeInTheDocument()
  })

  it('can be dismissed and picked up again from the stats menu', async () => {
    mockApi()
    render(<App />)
    await holdWordmark()

    fireEvent.click(await screen.findByRole('button', { name: 'Later' }))
    expect(screen.queryByText('Nobody has ever won')).not.toBeInTheDocument()

    await openStats()
    // Reachable from here whether or not the home screen is turned on, which
    // it is not in these tests.
    expect(await screen.findByRole('button', { name: /Order 6/ })).toBeInTheDocument()
  })
})

describe('playing it', () => {
  async function unlockAndOpen() {
    render(<App />)
    await holdWordmark()
    fireEvent.click(await screen.findByRole('button', { name: 'Try it now' }))
    await screen.findByText('Order 6')
  }

  it('deals a six slot board', async () => {
    mockApi()
    await unlockAndOpen()

    expect(screen.getByRole('button', { name: /^Position 6,/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Position 7,/ })).not.toBeInTheDocument()
  })

  it('keeps its own record of how it has gone', async () => {
    mockApi()
    await unlockAndOpen()
    await playShortBoardToTheEnd()

    const record = JSON.parse(localStorage.getItem('order20-short-record') ?? '{}')
    expect(record.games).toBe(1)
  })

  it('saves its game separately, so a twenty in progress is never lost', async () => {
    mockApi()
    render(<App />)
    // Let the free-play game be dealt and saved before anything else happens.
    await screen.findByRole('button', { name: 'View stats' })
    const freePlayBefore = localStorage.getItem('order20-current-game')
    expect(freePlayBefore).not.toBeNull()

    await holdWordmark()
    fireEvent.click(await screen.findByRole('button', { name: 'Try it now' }))
    await screen.findByText('Order 6')

    const shortGame = JSON.parse(localStorage.getItem('order20-short-game') ?? 'null')
    expect(shortGame.positions).toHaveLength(6)
    // Byte for byte what it was. Opening the short board must not so much as
    // re-roll the twenty waiting behind it.
    expect(localStorage.getItem('order20-current-game')).toBe(freePlayBefore)
  })
})

describe('what it must not touch', () => {
  async function playOneShortGame() {
    render(<App />)
    await holdWordmark()
    fireEvent.click(await screen.findByRole('button', { name: 'Try it now' }))
    await screen.findByText('Order 6')
    await playShortBoardToTheEnd()
  }

  // Only writes matter. The app reads the community summary and the recap on
  // startup regardless of any of this, and counting those as leaks would make
  // the assertion pass or fail for reasons that have nothing to do with
  // Order 6.
  function writesTo(fetchMock: ReturnType<typeof mockApi>, path: string): string[] {
    return fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      .map(([input]) => String(input))
      .filter(url => url.includes(path))
  }

  it('never reaches the leaderboard', async () => {
    // The best-runs board ranks by share of the board filled, so a 6 of 6
    // would sit at 100% above every real run and stay there.
    const fetchMock = mockApi()
    await playOneShortGame()

    expect(writesTo(fetchMock, '/scores')).toHaveLength(0)
    expect(writesTo(fetchMock, '/daily-scores')).toHaveLength(0)
    expect(writesTo(fetchMock, '/streaks')).toHaveLength(0)
  })

  it('never reaches the group feed or the game log', async () => {
    const fetchMock = mockApi()
    await playOneShortGame()

    expect(writesTo(fetchMock, '/games')).toHaveLength(0)
    expect(writesTo(fetchMock, '/placements')).toHaveLength(0)
  })

  it('never counts toward the main stats', async () => {
    // Mixing six slot games into the win rate would make that number mean
    // nothing at all. One game is seeded before each test, and it has to
    // still be one afterwards.
    mockApi()
    await playOneShortGame()

    await waitFor(() => {
      const stats = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) ?? '{}')
      expect(stats.totalGames).toBe(1)
    })
  })

  it('never counts toward the daily streak', async () => {
    mockApi()
    await playOneShortGame()

    expect(localStorage.getItem('order20-daily-streak')).toBeNull()
  })

  it('never becomes the free-play best score', async () => {
    mockApi()
    await playOneShortGame()

    expect(localStorage.getItem('order20-best-score')).toBeNull()
  })
})
