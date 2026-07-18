import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLocalDateString } from './game/daily'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  cleanup()
})

describe('home screen', () => {
  it('shows by default, with the brand mark, headline, and a Play button', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Ready to play?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('shows personal best and win streak on the stat cards', async () => {
    localStorage.setItem('order20-best-score', '14')
    localStorage.setItem(
      'order20-stats',
      JSON.stringify({
        totalGames: 4,
        totalWins: 3,
        totalTurns: 40,
        currentWinStreak: 3,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)

    await screen.findByRole('heading', { name: 'Ready to play?' })
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('Personal best')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Win streak')).toBeInTheDocument()
  })

  it("shows the daily challenge as not yet played by default", async () => {
    render(<App />)

    await screen.findByRole('heading', { name: 'Ready to play?' })
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play daily board' })).toBeInTheDocument()
  })

  it('shows the daily challenge as done once already played today', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
    const today = getLocalDateString()
    localStorage.setItem(
      'order20-daily-result',
      JSON.stringify({ date: today, positions: [10, null], placedCount: 1, status: 'lost', lossReason: 'No legal position.' }),
    )

    render(<App />)

    await screen.findByRole('heading', { name: 'Ready to play?' })
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "View today's result" })).toBeInTheDocument()
  })

  it('reveals the game board once Play is tapped', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))

    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ready to play?' })).not.toBeInTheDocument()
  })

  it('opens the daily challenge screen from Play daily board', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play daily board' }))

    expect(await screen.findByText("Today's challenge")).toBeInTheDocument()
  })

  it('opens the stats screen from See all stats', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'See all stats' }))

    expect(await screen.findByText('Stats')).toBeInTheDocument()
  })

  it('skips the home screen entirely when the setting is off', async () => {
    localStorage.setItem('order20-show-home-screen', '0')

    render(<App />)

    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ready to play?' })).not.toBeInTheDocument()
  })

  it('hides itself immediately and remembers the choice for next load', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Hide this screen' }))

    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ready to play?' })).not.toBeInTheDocument()
    expect(localStorage.getItem('order20-show-home-screen')).toBe('0')

    cleanup()
    render(<App />)
    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ready to play?' })).not.toBeInTheDocument()
  })

  it('does not show a finished game overlay behind the home screen', async () => {
    localStorage.setItem(
      'order20-current-game',
      JSON.stringify({
        positions: Array.from({ length: 20 }, (_, i) => (i + 1) * 10),
        usedNumbers: Array.from({ length: 20 }, (_, i) => (i + 1) * 10),
        currentRoll: null,
        validPositions: [],
        placedCount: 20,
        status: 'won',
        lossReason: null,
      }),
    )
    localStorage.setItem('order20-current-game-recorded', '1')

    render(<App />)

    await screen.findByRole('heading', { name: 'Ready to play?' })
    expect(screen.queryByRole('alertdialog', { name: 'Perfect order!' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('alertdialog', { name: 'Perfect order!' })).toBeInTheDocument()
  })
})
