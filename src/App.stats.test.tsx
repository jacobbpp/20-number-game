import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLocalDateString } from './game/daily'
import { recordGameResult } from './game/dailyActivity'
import { APP_VERSION } from './version'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

async function openHeatmap() {
  await openStats()
  fireEvent.click(await screen.findByRole('button', { name: /^Heatmap/ }))
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

describe('stats screen', () => {
  it('shows the daily streak line', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 6,
        totalWins: 2,
        totalTurns: 27,
        currentWinStreak: 0,
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        scoreDistribution: [1, 2, 2, 1],
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openStats()

    expect(await screen.findByText('Daily streak: No streak yet')).toBeInTheDocument()
  })

  it('navigating back from the heatmap returns to stats, not the game', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 1, totalWins: 1, totalTurns: 1, matrix: emptyMatrix(), lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openHeatmap()
    expect(await screen.findByText('Rarely lands here')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to stats' }))
    expect(await screen.findByRole('button', { name: /^Heatmap/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }))
    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
  })
})

describe('daily streak line', () => {
  it('shows the current and best daily streak as plain text, sourced from the daily challenge streak', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
    const today = getLocalDateString()
    localStorage.setItem('order20-daily-streak', JSON.stringify({ count: 3, lastPlayedDate: today, bestStreak: 6 }))
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 1,
        totalWins: 0,
        totalTurns: 3,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openStats()

    expect(await screen.findByText('Daily streak: 3 day streak')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('insights section', () => {
  it('shows a hero strip of best score, average score, games played today, and total wins', async () => {
    localStorage.setItem('order20-best-score', '14')
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 3,
        totalTurns: 16,
        currentWinStreak: 2,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )
    const today = getLocalDateString()
    let dailyActivity = recordGameResult({}, today, 3, [])
    dailyActivity = recordGameResult(dailyActivity, today, 5, ['day'])
    dailyActivity = recordGameResult(dailyActivity, '2000-01-01', 8, ['day', 'week', 'month', 'all'])
    localStorage.setItem('order20-daily-activity', JSON.stringify(dailyActivity))

    render(<App />)
    await openStats()

    const heroStrip = (await screen.findByText('best score')).closest('.stats-hero-strip') as HTMLElement
    expect(within(heroStrip).getByText('14')).toBeInTheDocument()
    expect(within(heroStrip).getByText('4.0')).toBeInTheDocument()
    expect(within(heroStrip).getByText('avg. score')).toBeInTheDocument()
    expect(within(heroStrip).getByText('games today')).toBeInTheDocument()
    // Only today's two logged games count, not the one from 2000-01-01.
    expect(within(heroStrip).getByText('2')).toBeInTheDocument()
    expect(within(heroStrip).getByText('wins')).toBeInTheDocument()
    expect(within(heroStrip).getByText('3')).toBeInTheDocument()
  })

})

describe('heatmap section', () => {
  it('switches the heatmap between All, Wins, and Losses', async () => {
    const winMatrix = emptyMatrix()
    winMatrix[5][3] = 7
    const lossMatrix = emptyMatrix()
    lossMatrix[8][6] = 4

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 5,
        totalWins: 1,
        totalTurns: 20,
        matrix: emptyMatrix(),
        winMatrix,
        lossMatrix,
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openHeatmap()

    fireEvent.click(await screen.findByRole('button', { name: 'Wins' }))
    expect(screen.getByRole('button', { name: 'Wins' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /wins only/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Losses' }))
    expect(screen.getByRole('button', { name: 'Losses' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /losses only/ })).toBeInTheDocument()
  })

  it('explains the heatmap with a gradient legend and clear copy', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 1, totalWins: 1, totalTurns: 5, matrix: emptyMatrix(), lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openHeatmap()

    const endsLabel = await screen.findByText('Rarely lands here')
    const legend = endsLabel.closest('.heatmap__legend') as HTMLElement
    expect(within(legend).getByText('Often lands here')).toBeInTheDocument()
    expect(within(legend).getByText('Outlined = where you placed a number last game')).toBeInTheDocument()
  })
})
