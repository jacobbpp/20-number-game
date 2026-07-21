import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLocalDateString } from './game/daily'
import { recordGameResult } from './game/dailyActivity'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

// engine.rollNumber computes floor(rng() * 1000) + 1, so (n - 1) / 1000
// deterministically produces roll n — same convention as engine.test.ts.
function valueForRoll(n: number) {
  return (n - 1) / 1000
}

function mockRollSequence(values: number[]) {
  let i = 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const n = values[Math.min(i, values.length - 1)]
    i += 1
    return valueForRoll(n)
  })
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// The Leaderboard row only shows once the Stats menu has games behind it.
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

// A URL-aware fetch stub covering every endpoint the app calls, so a single
// mock can drive both the community-dot fetch and the leaderboard flow.
function mockLeaderboardApi(
  options: { checkWindows?: string[]; entries?: { id: number; name: string; score: number; board: (number | null)[] | null }[] } = {},
) {
  const { checkWindows = [], entries = [] } = options
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = urlOf(input)
    if (url.includes('/scores/check')) {
      return Promise.resolve(new Response(JSON.stringify({ windows: checkWindows }), { status: 200 }))
    }
    if (url.includes('/scores/leaderboard')) {
      return Promise.resolve(new Response(JSON.stringify({ entries }), { status: 200 }))
    }
    if (url.includes('/scores')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
})

describe('leaderboard screen', () => {
  it('opens from the stats menu, fetches the default Day tab, and switches windows on tap', async () => {
    seedPlayedStats()
    const fetchMock = mockLeaderboardApi({ entries: [{ id: 1, name: 'TOM', score: 18, board: null }] })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))

    expect(await screen.findByText('TOM')).toBeInTheDocument()
    expect(screen.getByText('18/20')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(call => urlOf(call[0]).includes('window=day'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))

    await screen.findByRole('button', { name: 'Week', pressed: true })
    expect(fetchMock.mock.calls.some(call => urlOf(call[0]).includes('window=week'))).toBe(true)
  })

  it('shows an empty state when a window has no scores yet', async () => {
    seedPlayedStats()
    mockLeaderboardApi({ entries: [] })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))

    expect(await screen.findByText('No scores yet. Be the first.')).toBeInTheDocument()
  })

  it('returns to the stats menu, not the board, when closed', async () => {
    seedPlayedStats()
    mockLeaderboardApi()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back to stats' }))

    expect(await screen.findByRole('button', { name: /Leaderboard/ })).toBeInTheDocument()
  })

  it('shows the same player at multiple ranks when they have several qualifying games', async () => {
    seedPlayedStats()
    mockLeaderboardApi({
      entries: [
        { id: 1, name: 'JRC', score: 16, board: null },
        { id: 2, name: 'JRC', score: 15, board: null },
        { id: 3, name: 'REILLY', score: 9, board: null },
      ],
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))

    expect(await screen.findAllByText('JRC')).toHaveLength(2)
    expect(screen.getByText('16/20')).toBeInTheDocument()
    expect(screen.getByText('15/20')).toBeInTheDocument()
  })

  it('opens a board view of that specific game when a leaderboard row is tapped', async () => {
    seedPlayedStats()
    const board = [100, null, 250]
    mockLeaderboardApi({ entries: [{ id: 5, name: 'TOM', score: 2, board }] })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))
    fireEvent.click(await screen.findByRole('button', { name: /TOM/ }))

    expect(await screen.findByRole('heading', { name: '#1 TOM' })).toBeInTheDocument()
    expect(screen.getByText('2 of 3 placed')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it("shows a fallback message for a score saved before boards were recorded", async () => {
    seedPlayedStats()
    mockLeaderboardApi({ entries: [{ id: 6, name: 'OLD', score: 4, board: null }] })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Leaderboard/ }))
    fireEvent.click(await screen.findByRole('button', { name: /OLD/ }))

    expect(await screen.findByRole('heading', { name: '#1 OLD' })).toBeInTheDocument()
    expect(screen.getByText("This score was saved before boards were recorded, so there's nothing to show here.")).toBeInTheDocument()
  })

  it('submits the finished board alongside the score', async () => {
    const fetchMock = mockLeaderboardApi({ checkWindows: ['day'] })
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    await screen.findByText(/Top 10 today!/)
    fireEvent.change(screen.getByLabelText('Name for the leaderboard'), { target: { value: 'zee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }))

    const submitCall = fetchMock.mock.calls.find(call => urlOf(call[0]).endsWith('/scores') && call[1]?.method === 'POST')
    const body = JSON.parse(String(submitCall?.[1]?.body)) as { board?: unknown }
    expect(Array.isArray(body.board)).toBe(true)
    expect((body.board as unknown[]).length).toBe(20)
  })
})

describe('leaderboard name prompt', () => {
  it('shows the prompt after a qualifying loss, remembers the name on save, and reports the score', async () => {
    const fetchMock = mockLeaderboardApi({ checkWindows: ['day'] })
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    expect(await screen.findByText(/Top 10 today!/)).toBeInTheDocument()

    const input = screen.getByLabelText('Name for the leaderboard') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zee' } })
    expect(input.value).toBe('ZEE')

    fireEvent.click(screen.getByRole('button', { name: 'Save score' }))

    expect(screen.queryByText(/Top 10 today!/)).not.toBeInTheDocument()
    expect(localStorage.getItem('order20-leaderboard-name')).toBe('ZEE')
    const submitCall = fetchMock.mock.calls.find(call => urlOf(call[0]).endsWith('/scores') && call[1]?.method === 'POST')
    expect(submitCall).toBeDefined()
    expect(JSON.parse(String(submitCall?.[1]?.body))).toMatchObject({ boardSize: 20, name: 'ZEE', score: 2 })
  })

  it('hides the prompt without submitting when skipped', async () => {
    const fetchMock = mockLeaderboardApi({ checkWindows: ['day'] })
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    await screen.findByText(/Top 10 today!/)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.queryByText(/Top 10 today!/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(call => urlOf(call[0]).endsWith('/scores') && call[1]?.method === 'POST')).toBe(false)
  })

  it('never shows the prompt for a non-qualifying score', async () => {
    mockLeaderboardApi({ checkWindows: [] })
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    await screen.findByRole('heading', { name: 'Game over' })
    expect(screen.queryByLabelText('Name for the leaderboard')).not.toBeInTheDocument()
  })
})

describe('insights leaderboard activity', () => {
  it("logs every completed game's qualifying windows, not just the ones that made a board", async () => {
    mockLeaderboardApi({ checkWindows: [] })
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))
    await screen.findByRole('heading', { name: 'Game over' })

    const expected = recordGameResult({}, getLocalDateString(), 2, [])
    await vi.waitFor(() => {
      const log: unknown = JSON.parse(localStorage.getItem('order20-daily-activity') ?? '{}')
      expect(log).toEqual(expected)
    })
  })

  it('shows a Leaderboard reach panel summarizing today\'s qualifying games', async () => {
    seedPlayedStats()
    mockLeaderboardApi()
    const today = getLocalDateString()
    let dailyActivity = recordGameResult({}, today, 3, ['day'])
    dailyActivity = recordGameResult(dailyActivity, today, 3, ['week'])
    dailyActivity = recordGameResult(dailyActivity, today, 3, ['week'])
    dailyActivity = recordGameResult(dailyActivity, today, 3, ['all'])
    dailyActivity = recordGameResult(dailyActivity, today, 3, ['all'])
    dailyActivity = recordGameResult(dailyActivity, today, 3, ['all'])
    localStorage.setItem('order20-daily-activity', JSON.stringify(dailyActivity))

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Insights/ }))

    const panel = (await screen.findByText('🏆 Leaderboard reach')).closest('.insight-panel--leaderboard') as HTMLElement
    expect(within(panel).getByText('1')).toBeInTheDocument()
    expect(within(panel).getByText('today')).toBeInTheDocument()
    expect(within(panel).getByText('2')).toBeInTheDocument()
    expect(within(panel).getByText('week')).toBeInTheDocument()
    expect(within(panel).getByText('0')).toBeInTheDocument()
    expect(within(panel).getByText('month')).toBeInTheDocument()
    expect(within(panel).getByText('3')).toBeInTheDocument()
    expect(within(panel).getByText('all-time')).toBeInTheDocument()
  })
})
