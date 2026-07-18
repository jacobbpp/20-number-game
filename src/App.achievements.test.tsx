import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function seedStats(overrides: Partial<Record<string, unknown>> = {}) {
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 0,
      totalWins: 0,
      totalTurns: 0,
      winTurns: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      hardModeWins: 0,
      scoreDistribution: [0, 0, 0, 0],
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
      ...overrides,
    }),
  )
}

// A board one placement from winning: 19 of 20 slots filled in ascending
// order, the last slot empty, and a roll already in hand that's the only
// legal value for it — clicking it wins deterministically, no RNG involved.
function seedOneMoveFromWinning() {
  localStorage.setItem(
    'order20-current-game',
    JSON.stringify({
      positions: Array.from({ length: 20 }, (_, i) => (i < 19 ? (i + 1) * 10 : null)),
      usedNumbers: Array.from({ length: 19 }, (_, i) => (i + 1) * 10),
      currentRoll: 999,
      validPositions: [19],
      placedCount: 19,
      status: 'rolled',
      lossReason: null,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

describe('achievements', () => {
  it('shows the unlocked count on the Stats pill and opens the full list', async () => {
    seedStats({ totalWins: 1, totalGames: 1 })

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: /🏆/ }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Achievements' })
    expect(within(dialog).getByText('1 of 7 unlocked')).toBeInTheDocument()
    expect(within(dialog).getByText('First win')).toBeInTheDocument()
    expect(within(dialog).getByText('Century')).toBeInTheDocument()
  })

  it('silently backfills an already-earned achievement without a toast on first load', async () => {
    seedStats({ totalWins: 1, totalGames: 1 })

    render(<App />)
    await screen.findByRole('button', { name: 'View stats' })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a toast once the win overlay is dismissed, and opens the list when tapped', async () => {
    seedStats()
    seedOneMoveFromWinning()

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Position 20, empty, valid placement' }))
    // The toast waits for the win overlay to clear rather than floating on
    // top of its scrim — dismissing it (New game) is what surfaces the toast.
    fireEvent.click(await screen.findByRole('button', { name: 'New game' }))

    const toast = await screen.findByRole('status')
    expect(within(toast).getByText('First win')).toBeInTheDocument()

    fireEvent.click(within(toast).getByRole('button'))

    const dialog = await screen.findByRole('alertdialog', { name: 'Achievements' })
    expect(within(dialog).getByText('1 of 7 unlocked')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show the toast while the win overlay is covering the board', async () => {
    seedStats()
    seedOneMoveFromWinning()

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Position 20, empty, valid placement' }))

    await screen.findByRole('alertdialog', { name: 'Perfect order!' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
