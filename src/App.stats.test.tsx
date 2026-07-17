import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { APP_VERSION } from './version'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

describe('stats screen', () => {
  it('shows the overview cards and loss-pattern sentence once there is enough data', async () => {
    const lossBucketCounts = Array(10).fill(0)
    lossBucketCounts[2] = 3 // 201-300, the clear majority

    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 6,
        totalWins: 2,
        totalTurns: 27,
        matrix: emptyMatrix(),
        lossBucketCounts,
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('Win rate')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText(/avg 4\.5 turns/)).toBeInTheDocument()
    expect(screen.getByText(/Most losses happen when rolling in the 201–300 range/)).toBeInTheDocument()
  })

  it('hides the loss-pattern sentence without enough losses in one bucket', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 2,
        totalWins: 1,
        totalTurns: 10,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    await screen.findByText('Win rate')
    expect(screen.queryByText(/Most losses happen when rolling/)).not.toBeInTheDocument()
  })

  it('shows win streak, and folds avg. turns (overall and in wins) into the distribution caption', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 3,
        totalWins: 0,
        totalTurns: 9,
        winTurns: 0,
        currentWinStreak: 0,
        scoreDistribution: [3, 0, 0, 0],
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('Win streak')).toBeInTheDocument()
    // No wins yet, so the "in wins" clause is omitted rather than showing a placeholder.
    expect(screen.getByText('How far your runs usually get — avg 3.0 turns')).toBeInTheDocument()
  })

  it('adds an "in wins" clause to the distribution caption once there are wins', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 1,
        totalTurns: 20,
        winTurns: 5,
        currentWinStreak: 1,
        scoreDistribution: [0, 1, 0, 3],
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('How far your runs usually get — avg 5.0 turns, 5.0 in wins')).toBeInTheDocument()
  })

  it('shows a best-win-streak record only once one has been set', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 4,
        totalWins: 1,
        totalTurns: 20,
        winTurns: 5,
        currentWinStreak: 1,
        bestWinStreak: 4,
        scoreDistribution: [0, 1, 0, 3],
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    expect(await screen.findByText('Best: 4')).toBeInTheDocument()
  })

  it('hides the best-streak record when none has been set yet', async () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 2,
        totalWins: 0,
        totalTurns: 6,
        winTurns: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
        scoreDistribution: [2, 0, 0, 0],
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    await screen.findByText('Win streak')
    expect(screen.queryByText(/Best:/)).not.toBeInTheDocument()
  })

  it('describes the score distribution accessibly with actual counts', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    const chart = await screen.findByRole('img', { name: /How far your runs usually get/ })
    expect(chart).toHaveAccessibleName(
      'How far your runs usually get — avg 5.0 turns, 5.0 in wins: 1 game placed 0–5, 2 games placed 6–10, 0 games placed 11–15, 1 game placed 16–20',
    )
  })

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
        winTurns: 7,
        currentWinStreak: 0,
        scoreDistribution: [0, 1, 0, 4],
        matrix: emptyMatrix(),
        winMatrix,
        lossMatrix,
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

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
      JSON.stringify({
        totalGames: 1,
        totalWins: 1,
        totalTurns: 5,
        matrix: emptyMatrix(),
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    const endsLabel = await screen.findByText('Rarely lands here')
    const legend = endsLabel.closest('.heatmap__legend') as HTMLElement
    expect(within(legend).getByText('Often lands here')).toBeInTheDocument()
    expect(within(legend).getByText('Outlined = where you placed a number last game')).toBeInTheDocument()
  })
})
