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

async function openSection(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
}

async function openPatternsTab() {
  fireEvent.click(await screen.findByRole('button', { name: 'Patterns' }))
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

describe('stats menu', () => {
  it('shows a live preview of the Insights row, and a plain daily-streak line above the menu', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('Daily streak: No streak yet')).toBeInTheDocument()
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
  })

  it('shows a pattern count on the Insights row once there is enough signal', async () => {
    const matrix = emptyMatrix()
    matrix[3][2] = 4

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 6, totalWins: 2, totalTurns: 27, matrix, lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('1 pattern found')).toBeInTheDocument()
  })

  it('navigating back from a section returns to the menu, not the game', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 1, totalWins: 1, totalTurns: 1, matrix: emptyMatrix(), lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openSection('Heatmap')
    expect(await screen.findByText('Rarely lands here')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to stats menu' }))
    expect(await screen.findByRole('button', { name: /^Heatmap/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }))
    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
  })
})

describe('daily streak line', () => {
  it('shows the current and best daily streak as plain text on the menu, sourced from the daily challenge streak', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('Daily streak: 3 day streak')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('insights section', () => {
  it('shows a signature-position card once there are enough games', async () => {
    const matrix = emptyMatrix()
    matrix[3][0] = 5

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 5, totalWins: 2, totalTurns: 20, matrix, lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openSection('Insights')
    await openPatternsTab()

    expect(await screen.findByText('Signature position')).toBeInTheDocument()
    expect(screen.getByText(/Position 4 is your most-used slot, filled 5 times/)).toBeInTheDocument()
  })

  it('shows a hard-mode card once there are enough hard-mode games', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 6,
        totalWins: 3,
        totalTurns: 30,
        hardModeGames: 4,
        hardModeWins: 3,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Insights')
    await openPatternsTab()

    expect(await screen.findByText('Hard mode')).toBeInTheDocument()
    expect(screen.getByText("Hard mode hasn't slowed you down. You do just as well without the hints.")).toBeInTheDocument()
  })

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
    await openSection('Insights')

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

  it('shows a best-position card once a position has enough win-associated signal', async () => {
    const winMatrix = emptyMatrix()
    winMatrix[3][0] = 4
    const lossMatrix = emptyMatrix()
    lossMatrix[7][0] = 1

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 5,
        totalWins: 4,
        totalTurns: 20,
        matrix: emptyMatrix(),
        winMatrix,
        lossMatrix,
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Insights')
    await openPatternsTab()

    expect(await screen.findByText('Best position')).toBeInTheDocument()
    expect(screen.getByText('Position 4 is where you have your best record.')).toBeInTheDocument()
  })

  it('shows a board-half card once both halves have enough signal', async () => {
    const winMatrix = emptyMatrix()
    winMatrix[0][0] = 8
    const lossMatrix = emptyMatrix()
    lossMatrix[1][0] = 2
    lossMatrix[10][0] = 8
    winMatrix[11][0] = 2

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 20,
        totalWins: 10,
        totalTurns: 100,
        matrix: emptyMatrix(),
        winMatrix,
        lossMatrix,
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Insights')
    await openPatternsTab()

    expect(await screen.findByText('Board half')).toBeInTheDocument()
    expect(screen.getByText('Numbers you place in the top half of the board tend to work out better than the bottom half.')).toBeInTheDocument()
  })

  it('shows a streak-momentum card while chasing a past record', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 6,
        totalWins: 3,
        totalTurns: 30,
        currentWinStreak: 2,
        bestWinStreak: 5,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Insights')
    await openPatternsTab()

    expect(await screen.findByText('Streak momentum')).toBeInTheDocument()
    expect(screen.getByText('3 more wins ties your best streak ever.')).toBeInTheDocument()
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
    await openSection('Heatmap')

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
    await openSection('Heatmap')

    const endsLabel = await screen.findByText('Rarely lands here')
    const legend = endsLabel.closest('.heatmap__legend') as HTMLElement
    expect(within(legend).getByText('Often lands here')).toBeInTheDocument()
    expect(within(legend).getByText('Outlined = where you placed a number last game')).toBeInTheDocument()
  })
})
