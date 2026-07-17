import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
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

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${boardSize}-slot challenge`) }))

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
    expect(storedStreak).toEqual({ count: 1, lastPlayedDate: today })
  })

  it('does not re-record when re-opening the daily screen after a completed attempt', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    const { clicks } = simulateDailyGame(boardSize, rng)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${boardSize}-slot challenge`) }))
    for (const position of clicks) {
      fireEvent.click(await screen.findByRole('button', { name: `Position ${position + 1}, empty, valid placement` }))
    }
    await screen.findByText('Come back tomorrow for the next one.')

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    // Close and reopen the now-locked daily screen — a pure navigation
    // re-render, nothing that should touch storage again.
    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }))
    fireEvent.click(await screen.findByRole('button', { name: /today/ }))
    await screen.findByText('Come back tomorrow for the next one.')

    const resultWrites = setItemSpy.mock.calls.filter(([key]) => key === 'order20-daily-result')
    expect(resultWrites).toHaveLength(0)
  })
})
