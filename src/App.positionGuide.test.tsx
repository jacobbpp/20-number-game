import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
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

// The dot now reflects community history fetched from the stats API rather
// than anything read from localStorage — so tests stub the network call
// instead of seeding order20-stats.
function mockCommunitySummary(matrix: number[][]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix }), { status: 200 }))),
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

describe('position guide', () => {
  it('marks the position with the strongest community history for this roll among valid slots', async () => {
    seedFreshRolledGame(250) // bucket 2
    const matrix = emptyMatrix()
    matrix[5][2] = 5
    mockCommunitySummary(matrix)

    render(<App />)

    expect(
      await screen.findByRole('button', { name: 'Position 6, empty, valid placement, where players usually place this range' }),
    ).toBeInTheDocument()
    // No other position should carry the note.
    expect(screen.queryByRole('button', { name: /Position 7,.*usually place/ })).not.toBeInTheDocument()
  })

  it('does not mark anything without enough community history behind it', async () => {
    seedFreshRolledGame(250)
    mockCommunitySummary(emptyMatrix())

    render(<App />)

    await screen.findByRole('button', { name: 'Position 1, empty, valid placement' })
    expect(screen.queryByText(/usually place/)).not.toBeInTheDocument()
  })

  it('never shows the guide when hard mode is on', async () => {
    localStorage.setItem('order20-hard-mode', '1')
    seedFreshRolledGame(250)
    const matrix = emptyMatrix()
    matrix[5][2] = 5
    mockCommunitySummary(matrix)

    render(<App />)

    await screen.findByRole('button', { name: 'Position 1, empty' })
    expect(screen.queryByText(/usually place/)).not.toBeInTheDocument()
    expect(document.querySelector('.slot__suggested')).toBeNull()
  })
})
