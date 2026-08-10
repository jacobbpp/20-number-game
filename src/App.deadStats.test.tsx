import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

// Filling a twenty slot board has never happened, so every number derived
// from wins sits at zero permanently. These check that the app stops
// reporting arithmetic about an event that has not occurred, without hiding
// the event itself.

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/community/yesterday')) {
        return Promise.resolve(new Response(JSON.stringify({ date: '2026-08-09', summary: null }), { status: 200 }))
      }
      if (url.includes('/activity')) {
        return Promise.resolve(new Response(JSON.stringify({ events: [], playing: 0 }), { status: 200 }))
      }
      if (url.includes('/check')) {
        return Promise.resolve(new Response(JSON.stringify({ windows: [], qualifies: false }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
    }),
  )
}

function seedStats(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 84,
      totalWins: 0,
      totalTurns: 780,
      winTurns: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      // Enough hard mode games to clear MIN_HARD_MODE_GAMES, which is what
      // used to make the hard mode card appear at nought per cent.
      hardModeGames: 12,
      hardModeWins: 0,
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      scoreDistribution: [20, 30, 25, 9],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
      ...overrides,
    }),
  )
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
  mockApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('with nothing ever won', () => {
  it('does not claim hard mode has not slowed you down', async () => {
    // It reached that conclusion by comparing a nought per cent hard mode win
    // rate against a nought per cent ordinary one and finding them equal.
    seedStats()
    render(<App />)
    await openStats()

    expect(screen.queryByText('Hard mode')).not.toBeInTheDocument()
    expect(screen.queryByText(/hasn't slowed you down/)).not.toBeInTheDocument()
  })

  it('does not offer to filter the heatmap by a result that has never happened', async () => {
    seedStats()
    render(<App />)
    await openStats()
    fireEvent.click(await screen.findByRole('button', { name: /Heatmap/ }))

    await screen.findByText(/Where each value range has landed/)
    expect(screen.queryByRole('group', { name: 'Filter heatmap by result' })).not.toBeInTheDocument()
  })

  it('still shows the heatmap itself', async () => {
    // The data is real and useful. Only the three-way filter, where two of the
    // three views are empty or identical, goes away.
    seedStats()
    render(<App />)
    await openStats()
    fireEvent.click(await screen.findByRole('button', { name: /Heatmap/ }))

    expect(await screen.findByRole('img', { name: /Heatmap of how often/ })).toBeInTheDocument()
  })

  it('keeps the wins figure on the overview', async () => {
    // Deliberately still there. It is the honest number, it is the thing the
    // whole game is about, and it is the way into Order 6.
    seedStats()
    render(<App />)
    await openStats()

    expect(await screen.findByText('wins')).toBeInTheDocument()
  })
})

describe('once something has been won', () => {
  it('brings the hard mode card back', async () => {
    seedStats({ totalWins: 3, hardModeWins: 1, winTurns: 60 })
    render(<App />)
    await openStats()

    expect(await screen.findByText('Hard mode')).toBeInTheDocument()
  })

  it('brings the heatmap filter back', async () => {
    seedStats({ totalWins: 3, winTurns: 60 })
    render(<App />)
    await openStats()
    fireEvent.click(await screen.findByRole('button', { name: /Heatmap/ }))

    expect(await screen.findByRole('group', { name: 'Filter heatmap by result' })).toBeInTheDocument()
  })
})

describe('the home screen', () => {
  it('counts days played rather than a win streak that cannot move', async () => {
    localStorage.setItem('order20-show-home-screen', '1')
    localStorage.setItem(
      'order20-daily-streak',
      JSON.stringify({ count: 4, lastPlayedDate: new Date().toISOString().slice(0, 10), bestStreak: 6 }),
    )
    seedStats()
    render(<App />)

    expect(await screen.findByText('Daily streak')).toBeInTheDocument()
    expect(screen.queryByText('Win streak')).not.toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
