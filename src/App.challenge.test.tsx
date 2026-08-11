import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// The real record for JRC: the people this picker is built from.
const LIVE_RECORDS = [
  { name: 'SJW', days: 19, won: 6, lost: 5, drew: 8 },
  { name: 'YRC', days: 17, won: 7, lost: 3, drew: 7 },
  { name: 'ALR', days: 8, won: 4, lost: 2, drew: 2 },
  { name: 'DAD', days: 2, won: 0, lost: 1, drew: 1 },
  { name: 'ALEXANDR', days: 9, won: 5, lost: 0, drew: 4 },
  { name: 'NIG', days: 2, won: 2, lost: 0, drew: 0 },
]

function mockApi(records: unknown = LIVE_RECORDS) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      if (url.includes('/community/head-to-head')) {
        return Promise.resolve(new Response(JSON.stringify({ name: 'JRC', records }), { status: 200 }))
      }
      if (url.includes('/community/yesterday')) {
        return Promise.resolve(new Response(JSON.stringify({ date: '2026-08-10', summary: null }), { status: 200 }))
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

function seedPlayer() {
  localStorage.setItem('order20-leaderboard-name', 'JRC')
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 166,
      totalWins: 0,
      totalTurns: 1710,
      currentWinStreak: 0,
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      scoreDistribution: [30, 60, 50, 26],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

async function openHeadToHead() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
  fireEvent.click(await screen.findByRole('button', { name: /Head to head/ }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('choosing who a challenge is for', () => {
  it('offers everybody you actually play, most-played first', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openHeadToHead()

    const picker = await screen.findByRole('group', { name: 'Who the challenge is for' })
    const names = [...picker.querySelectorAll('button')].map(button => button.textContent)
    expect(names).toEqual(['Anyone', 'SJW', 'YRC', 'ALEXANDR', 'ALR', 'DAD', 'NIG'])
  })

  it('includes people the nemesis card leaves out', async () => {
    // Two shared days is not a rivalry, but it is plenty to send somebody a
    // code.
    mockApi()
    seedPlayer()
    render(<App />)
    await openHeadToHead()

    expect(await screen.findByRole('button', { name: 'DAD' })).toBeInTheDocument()
  })

  it('starts open to anybody, which is what it did before', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openHeadToHead()

    expect(await screen.findByRole('button', { name: 'Anyone' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Start a challenge' })).toBeInTheDocument()
  })

  it('names the person once you pick one', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    await openHeadToHead()

    fireEvent.click(await screen.findByRole('button', { name: 'YRC' }))

    expect(screen.getByRole('button', { name: 'Challenge YRC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'YRC' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Anyone' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens with the nemesis picked when the challenge came from their card', async () => {
    mockApi()
    seedPlayer()
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Challenge SJW' }))

    expect(await screen.findByRole('button', { name: 'Challenge SJW' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SJW' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows no picker at all to somebody with nobody to play', async () => {
    mockApi([])
    seedPlayer()
    render(<App />)
    await openHeadToHead()

    expect(await screen.findByRole('button', { name: 'Start a challenge' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Who the challenge is for' })).not.toBeInTheDocument()
  })
})
