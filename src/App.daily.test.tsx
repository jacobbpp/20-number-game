import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
import { peekNextRolls } from './game/dailyPeek'
import { place, roll } from './game/engine'
import { createInitialState, type GameState } from './game/types'
import { APP_VERSION } from './version'

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
})
