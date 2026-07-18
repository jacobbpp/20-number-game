import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getLocalDateString } from './game/daily'
import { APP_VERSION } from './version'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

async function openSection(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
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
  it('shows a live preview of each category on its menu row', async () => {
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

    expect(await screen.findByText('33% win rate · streak 0')).toBeInTheDocument()
    expect(screen.getByText('4.5 avg. turns')).toBeInTheDocument()
    expect(screen.getByText('No streak yet')).toBeInTheDocument()
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
  })

  it('shows a pattern count on the Insights row once there is enough signal', async () => {
    const lossBucketCounts = Array(10).fill(0)
    lossBucketCounts[2] = 3

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 6, totalWins: 2, totalTurns: 27, matrix: emptyMatrix(), lossBucketCounts, lastGame: null }),
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
    await openSection('Win rate & streak')
    expect(await screen.findByText('win rate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to stats menu' }))
    expect(await screen.findByRole('button', { name: /^Heatmap/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to game' }))
    expect(await screen.findByRole('button', { name: 'View stats' })).toBeInTheDocument()
  })
})

describe('win rate & streak section', () => {
  it('shows win rate and current streak', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 6,
        totalWins: 2,
        totalTurns: 27,
        currentWinStreak: 2,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Win rate & streak')

    expect(await screen.findByText('33%')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows a best-win-streak record only once one has been set', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 1,
        totalTurns: 20,
        currentWinStreak: 1,
        bestWinStreak: 4,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Win rate & streak')

    expect(await screen.findByText('Best: 4')).toBeInTheDocument()
  })

  it('hides the best-streak record when none has been set yet', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 2,
        totalWins: 0,
        totalTurns: 6,
        currentWinStreak: 0,
        bestWinStreak: 0,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Win rate & streak')

    await screen.findByText('win rate')
    expect(screen.queryByText(/Best:/)).not.toBeInTheDocument()
  })
})

describe('daily streak section', () => {
  it('shows the current and best daily streak, sourced from the daily challenge streak', async () => {
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
    await openSection('Daily streak')

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('Best: 6')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('average score section', () => {
  it('shows avg turns overall and in wins, and an accessible chart description', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 1,
        totalTurns: 20,
        winTurns: 5,
        currentWinStreak: 1,
        bestWinStreak: 1,
        scoreDistribution: [1, 2, 0, 1],
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Average score')

    expect(await screen.findByText('5.0')).toBeInTheDocument()
    expect(screen.getByText('5.0 in wins')).toBeInTheDocument()

    const chart = screen.getByRole('img', { name: /Average 5\.0 turns per game/ })
    expect(chart).toHaveAccessibleName(
      'Average 5.0 turns per game, 5.0 in wins: 1 game placed 0–5, 2 games placed 6–10, 0 games placed 11–15, 1 game placed 16–20',
    )
  })

  it('omits the "in wins" clause when there are no wins yet', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 3,
        totalWins: 0,
        totalTurns: 9,
        scoreDistribution: [3, 0, 0, 0],
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Average score')

    expect(await screen.findByText('3.0')).toBeInTheDocument()
    expect(screen.queryByText(/in wins/)).not.toBeInTheDocument()
  })
})

describe('insights section', () => {
  it('shows the loss-pattern sentence once there is enough data', async () => {
    const lossBucketCounts = Array(10).fill(0)
    lossBucketCounts[2] = 3 // 201-300, the clear majority

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 6, totalWins: 2, totalTurns: 27, matrix: emptyMatrix(), lossBucketCounts, lastGame: null }),
    )

    render(<App />)
    await openSection('Insights')

    expect(await screen.findByText(/Most losses happen when rolling in the 201–300 range/)).toBeInTheDocument()
  })

  it('shows a not-enough-data message without enough losses in one bucket', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 2, totalWins: 1, totalTurns: 10, matrix: emptyMatrix(), lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openSection('Insights')

    expect(await screen.findByText(/Not enough games yet/)).toBeInTheDocument()
    expect(screen.queryByText(/Most losses happen when rolling/)).not.toBeInTheDocument()
  })

  it('shows a best-range card once a value range has enough win-associated signal', async () => {
    const winMatrix = emptyMatrix()
    winMatrix[0][2] = 4
    const lossMatrix = emptyMatrix()
    lossMatrix[1][2] = 1

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

    expect(await screen.findByText('Best range')).toBeInTheDocument()
    expect(screen.getByText(/201–300 is your strongest range — 80% of placements there end in a win/)).toBeInTheDocument()
  })

  it('shows a signature-position card once there are enough games', async () => {
    const matrix = emptyMatrix()
    matrix[3][0] = 5

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ totalGames: 5, totalWins: 2, totalTurns: 20, matrix, lossBucketCounts: Array(10).fill(0), lastGame: null }),
    )

    render(<App />)
    await openSection('Insights')

    expect(await screen.findByText('Signature position')).toBeInTheDocument()
    expect(screen.getByText(/Position 4 is your most-used slot — filled 5 times/)).toBeInTheDocument()
  })

  it('shows a hard-mode win-rate card once there are enough hard-mode games', async () => {
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

    expect(await screen.findByText('Hard mode')).toBeInTheDocument()
    expect(screen.getByText('75% win rate with hard mode on, vs 50% overall.')).toBeInTheDocument()
  })

  it('shows a hero strip of best score, win rate, and win streak', async () => {
    localStorage.setItem('order20-best-score', '14')
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 2,
        totalTurns: 16,
        currentWinStreak: 2,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    await openSection('Insights')

    expect(await screen.findByText('14')).toBeInTheDocument()
    expect(screen.getByText('best score')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('win rate')).toBeInTheDocument()
    expect(screen.getByText('win streak')).toBeInTheDocument()
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

    expect(await screen.findByText('Best position')).toBeInTheDocument()
    expect(screen.getByText(/Position 4 has your best record — 100% of placements there end in a win/)).toBeInTheDocument()
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

    expect(await screen.findByText('Board half')).toBeInTheDocument()
    expect(screen.getByText(/Numbers you place in the top half of the board win more often \(80% vs 20%\)/)).toBeInTheDocument()
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
