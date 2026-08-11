import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// Exactly what the deployed endpoint returned for JRC on 2026-08-11. Kept
// verbatim so this test fails if the shape the worker sends ever drifts from
// the shape the app reads.
const LIVE_RECORDS = [
  { name: 'SJW', days: 19, won: 6, lost: 5, drew: 8 },
  { name: 'YRC', days: 17, won: 7, lost: 3, drew: 7 },
  { name: 'ALR', days: 8, won: 4, lost: 2, drew: 2 },
  { name: 'DAD', days: 2, won: 0, lost: 1, drew: 1 },
  { name: 'ALEXANDR', days: 9, won: 5, lost: 0, drew: 4 },
  { name: 'NIG', days: 2, won: 2, lost: 0, drew: 0 },
]

function mockApi(records: unknown = LIVE_RECORDS, status = 200) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (url.includes('/community/head-to-head')) {
      if (status !== 200) return Promise.reject(new Error('offline'))
      return Promise.resolve(new Response(JSON.stringify({ name: 'JRC', records }), { status: 200 }))
    }
    if (url.includes('/community/yesterday')) {
      return Promise.resolve(new Response(JSON.stringify({ date: '2026-08-10', summary: null }), { status: 200 }))
    }
    if (url.includes('/activity')) {
      return Promise.resolve(new Response(JSON.stringify({ events: [], playing: 0 }), { status: 200 }))
    }
    if (url.includes('/check')) {
      return Promise.resolve(new Response(JSON.stringify({ windows: [], qualifies: false }), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function seedPlayer(name: string | null = 'JRC') {
  if (name) localStorage.setItem('order20-leaderboard-name', name)
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 166,
      totalWins: 0,
      totalTurns: 1710,
      currentWinStreak: 0,
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      scoreDistribution: [30, 60, 50, 26],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('the nemesis card', () => {
  it('names whoever has actually beaten you most', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openStats()

    expect(await screen.findByText('Your nemesis')).toBeInTheDocument()
    expect(screen.getByText('SJW')).toBeInTheDocument()
  })

  it('shows all three outcomes, because level is the biggest of them', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText('Your nemesis')
    expect(screen.getByText('6 won')).toBeInTheDocument()
    expect(screen.getByText('8 level')).toBeInTheDocument()
    expect(screen.getByText('5 lost')).toBeInTheDocument()
  })

  it('says how the record actually stands', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openStats()

    expect(await screen.findByText(/19 shared days on the same board, 8 of them level/)).toBeInTheDocument()
  })

  it('names the one who has never come out ahead', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openStats()

    expect(await screen.findByText('Never beaten you')).toBeInTheDocument()
    expect(screen.getByText('ALEXANDR')).toBeInTheDocument()
  })

  it('leaves the two-day rivals out of both', async () => {
    // DAD has beaten you once and NIG never has, but two shared days is a
    // coincidence rather than a record.
    mockApi()
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText('Your nemesis')
    expect(screen.queryByText('DAD')).not.toBeInTheDocument()
    expect(screen.queryByText('NIG')).not.toBeInTheDocument()
  })
})

describe('when there is nothing to say', () => {
  it('shows no card at all before there are enough shared days', async () => {
    mockApi([{ name: 'SJW', days: 2, won: 0, lost: 2, drew: 0 }])
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText(/Daily streak/)
    expect(screen.queryByText('Your nemesis')).not.toBeInTheDocument()
  })

  it('shows no card when nobody has ever beaten you', async () => {
    mockApi([{ name: 'ALEXANDR', days: 9, won: 5, lost: 0, drew: 4 }])
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText('Never beaten you')
    expect(screen.queryByText('Your nemesis')).not.toBeInTheDocument()
  })

  it('asks for nothing at all without a saved name', async () => {
    // The record is keyed on the leaderboard name, so there is nobody to
    // compare and no request worth making.
    const fetchMock = mockApi()
    seedPlayer(null)
    render(<App />)
    await openStats()

    await screen.findByText(/Daily streak/)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/community/head-to-head'))).toHaveLength(0)
    expect(screen.queryByText('Your nemesis')).not.toBeInTheDocument()
  })

  it('stays quiet when the worker cannot be reached', async () => {
    mockApi(LIVE_RECORDS, 500)
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText(/Daily streak/)
    expect(screen.queryByText('Your nemesis')).not.toBeInTheDocument()
  })

  it('ignores a response that is not the shape it expects', async () => {
    mockApi([{ name: 'SJW', days: 'nineteen' }])
    seedPlayer()
    render(<App />)
    await openStats()

    await screen.findByText(/Daily streak/)
    expect(screen.queryByText('Your nemesis')).not.toBeInTheDocument()
  })
})
