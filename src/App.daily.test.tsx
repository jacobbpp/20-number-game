import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
import { peekNextRolls } from './game/dailyPeek'
import { place, roll } from './game/engine'
import { createInitialState, type GameState } from './game/types'
import { APP_VERSION } from './version'

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

function mockDailyLeaderboardApi(options: { qualifies?: boolean } = {}) {
  const { qualifies = false } = options
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = urlOf(input)
    if (url.includes('/daily-scores/check')) {
      return Promise.resolve(new Response(JSON.stringify({ qualifies }), { status: 200 }))
    }
    if (url.includes('/daily-scores')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (url.includes('/scores/check')) {
      return Promise.resolve(new Response(JSON.stringify({ windows: [] }), { status: 200 }))
    }
    if (url.includes('/scores')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (url.includes('/streaks')) {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    const emptyMatrix = Array.from({ length: 20 }, () => Array(10).fill(0))
    return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Mirrors App.tsx's handleDailySelect exactly (place at the rolled number's
// first valid position, then roll again unless the game just ended) so the
// click sequence below drives the DOM through the identical path the real
// seeded daily RNG would take for a frozen "today".
function simulateDailyGame(boardSize: number, rng: () => number) {
  let state: GameState = roll(createInitialState(boardSize), rng)
  const clicks: number[] = []

  while (state.status === 'rolled') {
    const position = state.validPositions[0]
    clicks.push(position)
    const placed = place(state, position)
    if (placed.status !== 'idle') {
      state = placed
      break
    }
    state = roll(placed, rng)
  }

  return { clicks, finalState: state }
}

beforeEach(() => {
  localStorage.clear()
  // Skip the first-launch onboarding overlay and the What's New popup —
  // not what these tests cover.
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
  // Frozen "today" so getDailyBoardSize/createDailyRng/getLocalDateString
  // all agree with what App.tsx's dailyDateRef captures at mount.
  vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  cleanup()
})

describe('App daily challenge', () => {
  it('records exactly one daily result and one streak update after completing today\'s attempt', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks, finalState } = simulateDailyGame(boardSize, rng)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))

    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }

    if (finalState.status === 'won') {
      await screen.findByText(`Perfect ${boardSize}/${boardSize} today!`)
    } else {
      await screen.findByText(`${finalState.placedCount} of ${boardSize} today`)
    }

    // The precise regression check: count writes rather than just inspecting
    // final storage content, so a double-fire that happens to write the same
    // value twice still gets caught (same style as the free-play stats
    // double-recording proof in App.test.tsx).
    const resultWrites = setItemSpy.mock.calls.filter(([key]) => key === 'order20-daily-result')
    expect(resultWrites).toHaveLength(1)

    const storedResult: unknown = JSON.parse(localStorage.getItem('order20-daily-result') ?? 'null')
    expect(storedResult).toMatchObject({
      date: today,
      status: finalState.status,
      placedCount: finalState.placedCount,
    })

    const storedStreak: unknown = JSON.parse(localStorage.getItem('order20-daily-streak') ?? 'null')
    expect(storedStreak).toEqual({ count: 1, lastPlayedDate: today, bestStreak: 1 })
  })

  it('submits the streak leaderboard entry once a name is already remembered', async () => {
    localStorage.setItem('order20-leaderboard-name', 'JRC')
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks } = simulateDailyGame(boardSize, rng)
    const fetchMock = mockDailyLeaderboardApi()

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }
    await screen.findByText('Come back tomorrow for the next one.')

    const submitCall = fetchMock.mock.calls.find(call => urlOf(call[0]).endsWith('/streaks') && call[1]?.method === 'POST')
    expect(submitCall).toBeDefined()
    const body = JSON.parse(String(submitCall?.[1]?.body)) as { name?: unknown; streakCount?: unknown; lastPlayedDate?: unknown; deviceId?: unknown }
    expect(body).toMatchObject({ name: 'JRC', streakCount: 1, lastPlayedDate: today })
    expect(typeof body.deviceId).toBe('string')
  })

  it('does not submit a streak leaderboard entry when no name has been remembered yet', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks } = simulateDailyGame(boardSize, rng)
    const fetchMock = mockDailyLeaderboardApi()

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }
    await screen.findByText('Come back tomorrow for the next one.')

    expect(fetchMock.mock.calls.some(call => urlOf(call[0]).endsWith('/streaks') && call[1]?.method === 'POST')).toBe(false)
  })

  it('streak pill copies a share message and shows "Copied!" when tapped', async () => {
    const today = getLocalDateString()
    localStorage.setItem(
      'order20-daily-result',
      JSON.stringify({ date: today, positions: [64, 75], placedCount: 2, status: 'lost', lossReason: null }),
    )
    localStorage.setItem('order20-daily-streak', JSON.stringify({ count: 5, lastPlayedDate: today, bestStreak: 5 }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Today's challenge/ }))

    const streakButton = await screen.findByRole('button', { name: /5 day streak/ })
    fireEvent.click(streakButton)

    expect(writeText).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  it('does not re-record when re-opening the daily screen after a completed attempt', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks } = simulateDailyGame(boardSize, rng)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }
    await screen.findByText('Come back tomorrow for the next one.')

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    // Close and reopen the now-locked daily screen — a pure navigation
    // re-render, nothing that should touch storage again.
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }))
    fireEvent.click(await screen.findByRole('button', { name: /Today's challenge/ }))
    await screen.findByText('Come back tomorrow for the next one.')

    const resultWrites = setItemSpy.mock.calls.filter(([key]) => key === 'order20-daily-result')
    expect(resultWrites).toHaveLength(0)
  })

  it('shows the loss reason and what would have come next after a daily loss', async () => {
    // A date confirmed (by direct simulation) to end in a loss with this
    // always-place-at-the-first-valid-position strategy.
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0))
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks, finalState } = simulateDailyGame(boardSize, rng)
    expect(finalState.status).toBe('lost')

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }

    await screen.findByText(`${finalState.placedCount} of ${boardSize} today`)
    expect(screen.getByText(finalState.lossReason ?? '')).toBeInTheDocument()

    expect(await screen.findByText('What came next')).toBeInTheDocument()
    const expectedPeeks = peekNextRolls(today, finalState.usedNumbers, finalState.positions)
    for (const peek of expectedPeeks) {
      expect(screen.getByText(String(peek.value))).toBeInTheDocument()
    }
  })

  it('never shows a loss reason or peek for a won daily result', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const positions = Array.from({ length: boardSize }, (_, i) => Math.round(((i + 1) * 1000) / (boardSize + 1)))
    localStorage.setItem(
      'order20-daily-result',
      JSON.stringify({ date: today, positions, placedCount: boardSize, status: 'won', lossReason: null, usedNumbers: positions }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Today's challenge/ }))

    await screen.findByText(`Perfect ${boardSize}/${boardSize} today!`)
    expect(screen.queryByText('What came next')).not.toBeInTheDocument()
  })

  it('shows the loss reason but no peek for a result saved before usedNumbers existed', async () => {
    const today = getLocalDateString()
    localStorage.setItem(
      'order20-daily-result',
      JSON.stringify({
        date: today,
        positions: [64, 75],
        placedCount: 2,
        status: 'lost',
        lossReason: '99 cannot legally be placed in any remaining position.',
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Today's challenge/ }))

    expect(await screen.findByText('99 cannot legally be placed in any remaining position.')).toBeInTheDocument()
    expect(screen.queryByText('What came next')).not.toBeInTheDocument()
  })

  it('shows the daily leaderboard prompt on a qualifying result and submits the ending roll', async () => {
    vi.setSystemTime(new Date(2026, 6, 19, 12, 0, 0))
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks, finalState } = simulateDailyGame(boardSize, rng)
    expect(finalState.status).toBe('lost')
    const fetchMock = mockDailyLeaderboardApi({ qualifies: true })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }

    expect(await screen.findByText(/Top 10 in today's daily challenge!/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name for the leaderboard'), { target: { value: 'zee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save score' }))

    expect(screen.queryByText(/Top 10 in today's daily challenge!/)).not.toBeInTheDocument()
    const submitCall = fetchMock.mock.calls.find(call => urlOf(call[0]).endsWith('/daily-scores') && call[1]?.method === 'POST')
    const body = JSON.parse(String(submitCall?.[1]?.body)) as { boardSize?: unknown; date?: unknown; name?: unknown; endingRoll?: unknown }
    expect(body).toMatchObject({ boardSize, date: today, name: 'ZEE', endingRoll: finalState.currentRoll })
  })

  it('does not show the daily leaderboard prompt when the result does not qualify', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks, finalState } = simulateDailyGame(boardSize, rng)
    mockDailyLeaderboardApi({ qualifies: false })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Today's ${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }

    if (finalState.status === 'won') {
      await screen.findByText(`Perfect ${boardSize}/${boardSize} today!`)
    } else {
      await screen.findByText(`${finalState.placedCount} of ${boardSize} today`)
    }
    expect(screen.queryByText(/Top 10 in today's daily challenge!/)).not.toBeInTheDocument()
  })
})
