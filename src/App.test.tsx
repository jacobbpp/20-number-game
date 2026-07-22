import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { BEST_SCORE_STORAGE_KEY } from './hooks/useBestScore'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// Bucket 4 (values 401-500) is the only range with enough signal (3+
// placements), so allValueRangeStats picks it as both best and worst —
// non-null either way, which is all the "Practice this range" button
// presence check actually needs.
function seedWorstRangeStats() {
  const winMatrix = emptyMatrix()
  const lossMatrix = emptyMatrix()
  winMatrix[0][4] = 1
  lossMatrix[0][4] = 2
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 3,
      totalWins: 1,
      totalTurns: 6,
      currentWinStreak: 0,
      matrix: emptyMatrix(),
      winMatrix,
      lossMatrix,
      scoreDistribution: [1, 1, 1, 0],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

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

beforeEach(() => {
  localStorage.clear()
  // Skip the first-launch onboarding overlay and the What's New popup —
  // not what these tests cover.
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('App', () => {
  it('auto-rolls the next number immediately after a valid placement, with no Roll button', async () => {
    mockRollSequence([64, 500])
    render(<App />)

    expect(await screen.findByText('64')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Roll$/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Position 1, empty, valid placement' }))

    expect(await screen.findByText('500')).toBeInTheDocument()
    expect(screen.getByText(/1 of 20 placed/)).toBeInTheDocument()
  })

  it('shows Game Over exactly once when a roll has no legal position', async () => {
    // Same scenario as the spec's own example: 64 then 75, then 63 has nowhere to go.
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    expect(await screen.findByRole('heading', { name: 'Game over' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Game over' })).toHaveLength(1)
  })

  it('shows how far an ordinary loss fell short of the existing record', async () => {
    localStorage.setItem(BEST_SCORE_STORAGE_KEY, '5')
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    expect(await screen.findByText(/2 of 20 placed · 3 away from your record/)).toBeInTheDocument()
  })

  it('does not show a distance-from-record line on a new best', async () => {
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    expect(await screen.findByText(/new best!/)).toBeInTheDocument()
    expect(screen.queryByText(/away from your record/)).not.toBeInTheDocument()
  })

  it('starts a practice run from Insights, restarting the board and labelling the weak range', async () => {
    seedWorstRangeStats()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /Insights/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Practice 401–500' }))

    // Closing Insights returns straight to the board, now labelled as a
    // practice run rather than sitting behind another confirmation step.
    expect(screen.queryByRole('heading', { name: 'Stats' })).not.toBeInTheDocument()
    expect(await screen.findByText('Practicing 401–500')).toBeInTheDocument()
    expect(screen.getByText(/0 of 20 placed/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.queryByText('Practicing 401–500')).not.toBeInTheDocument()
  })

  it('records a completed game into stats exactly once, not zero and not twice', async () => {
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))

    await screen.findByRole('heading', { name: 'Game over' })

    const stored: unknown = JSON.parse(localStorage.getItem('order20-stats') ?? 'null')
    expect(stored).toMatchObject({ totalGames: 1 })
  })
})
