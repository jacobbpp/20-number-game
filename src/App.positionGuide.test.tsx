import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function seedFreshRolledGame(currentRoll: number) {
  localStorage.setItem(
    'order20-current-game',
    JSON.stringify({
      positions: Array(20).fill(null),
      usedNumbers: [currentRoll],
      currentRoll,
      validPositions: Array.from({ length: 20 }, (_, i) => i),
      placedCount: 0,
      status: 'rolled',
      lossReason: null,
    }),
  )
}

function seedStatsWithStrongSignalAt(position: number, bucket: number) {
  const matrix = emptyMatrix()
  matrix[position][bucket] = 5
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 5,
      totalWins: 2,
      totalTurns: 40,
      winTurns: 20,
      currentWinStreak: 0,
      bestWinStreak: 1,
      hardModeWins: 0,
      scoreDistribution: [0, 2, 2, 1],
      matrix,
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

describe('position guide', () => {
  it('marks the position with the strongest history for this roll among valid slots', async () => {
    seedFreshRolledGame(250) // bucket 2
    seedStatsWithStrongSignalAt(5, 2)

    render(<App />)

    expect(
      await screen.findByRole('button', { name: 'Position 6, empty, valid placement, your usual spot for this range' }),
    ).toBeInTheDocument()
    // No other position should carry the note.
    expect(screen.queryByRole('button', { name: /Position 7,.*usual spot/ })).not.toBeInTheDocument()
  })

  it('does not mark anything without enough history behind it', async () => {
    seedFreshRolledGame(250)
    // Fresh stats — no signal anywhere.
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
      }),
    )

    render(<App />)

    await screen.findByRole('button', { name: 'Position 1, empty, valid placement' })
    expect(screen.queryByText(/usual spot/)).not.toBeInTheDocument()
  })

  it('never shows the guide when hard mode is on', async () => {
    localStorage.setItem('order20-hard-mode', '1')
    seedFreshRolledGame(250)
    seedStatsWithStrongSignalAt(5, 2)

    render(<App />)

    await screen.findByRole('button', { name: 'Position 1, empty' })
    expect(screen.queryByText(/usual spot/)).not.toBeInTheDocument()
    expect(document.querySelector('.slot__suggested')).toBeNull()
  })
})
