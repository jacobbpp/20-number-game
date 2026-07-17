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
    expect(screen.getByText('Avg. turns')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
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
