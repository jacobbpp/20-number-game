import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
import { place, roll } from './game/engine'
import { createInitialState, type GameState } from './game/types'
import { APP_VERSION } from './version'

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

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  cleanup()
})

describe('free play persistence', () => {
  it('resumes an in-progress game after a refresh instead of starting over', async () => {
    mockRollSequence([64, 75])
    render(<App />)

    expect(await screen.findByText('64')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Position 1, empty, valid placement' }))
    await screen.findByText('75')

    cleanup()
    render(<App />)

    // Same placement and same pending roll survive the "refresh".
    expect(await screen.findByRole('button', { name: 'Position 1, filled with 64' })).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText(/1 of 20 placed/)).toBeInTheDocument()
  })

  it('does not double-record a finished game after a refresh', async () => {
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))
    await screen.findByRole('heading', { name: 'Game over' })

    cleanup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Game over' })
    const stored: unknown = JSON.parse(localStorage.getItem('order20-stats') ?? 'null')
    expect(stored).toMatchObject({ totalGames: 1 })
  })

  it('starts a fresh game when nothing is persisted', async () => {
    mockRollSequence([64])
    render(<App />)

    expect(await screen.findByText('64')).toBeInTheDocument()
    expect(screen.getByText(/0 of 20 placed/)).toBeInTheDocument()
  })
})

describe('daily challenge persistence', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
  })

  it('resumes an in-progress daily attempt after a refresh', async () => {
    const today = getLocalDateString()
    const boardSize = getDailyBoardSize(today)
    const rng = createDailyRng(today)
    let state: GameState = roll(createInitialState(boardSize), rng)
    const firstPosition = state.validPositions[0]
    const placed = place(state, firstPosition)
    state = placed.status === 'idle' ? roll(placed, rng) : placed

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${boardSize}-slot challenge`) }))
    fireEvent.click(await screen.findByRole('button', { name: `Position ${firstPosition + 1}, empty, valid placement` }))
    await screen.findByText(String(state.currentRoll))

    cleanup()
    render(<App />)
    // The attempt isn't finished, so the badge is still the CTA state
    // ("{size}-slot challenge"), not the "today" recap wording.
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${boardSize}-slot challenge`) }))

    expect(
      await screen.findByRole('button', { name: `Position ${firstPosition + 1}, filled with ${placed.currentRoll ?? placed.positions[firstPosition]}` }),
    ).toBeInTheDocument()
  })

  it('does not resume a stale in-progress attempt from a previous day', async () => {
    localStorage.setItem(
      'order20-current-daily-game',
      JSON.stringify({
        date: '2020-01-01',
        state: { status: 'idle', positions: [1, null], usedNumbers: [1], currentRoll: null, validPositions: [], placedCount: 1, lossReason: null },
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /slot challenge/ }))

    expect(await screen.findByText(/0 of .+ placed/)).toBeInTheDocument()
    expect(screen.queryByText(/1 of .+ placed/)).not.toBeInTheDocument()
  })

  it('discards a same-day in-progress attempt whose size no longer matches today\'s rotation', async () => {
    const today = getLocalDateString()
    const actualSize = getDailyBoardSize(today)

    localStorage.setItem(
      'order20-current-daily-game',
      JSON.stringify({
        date: today,
        state: {
          status: 'idle',
          positions: Array(20).fill(null),
          usedNumbers: [],
          currentRoll: null,
          validPositions: [],
          placedCount: 0,
          lossReason: null,
        },
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`${actualSize}-slot challenge`) }))

    expect(await screen.findByText(`0 of ${actualSize} placed · tap a lit position`)).toBeInTheDocument()
  })
})
