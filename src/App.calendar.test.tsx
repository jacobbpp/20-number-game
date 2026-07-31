import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addDays, getLocalDateString } from './game/daily'
import { recordGameResult, type DailyActivityLog } from './game/dailyActivity'
import { formatFullDateLabel } from './game/share'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

const TODAY = getLocalDateString()
const YESTERDAY = addDays(TODAY, -1)
const QUIET_DAY = addDays(TODAY, -2)

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function seedPlayedStats() {
  localStorage.setItem(
    STATS_STORAGE_KEY,
    JSON.stringify({
      totalGames: 6,
      totalWins: 0,
      totalTurns: 40,
      currentWinStreak: 0,
      matrix: emptyMatrix(),
      winMatrix: emptyMatrix(),
      lossMatrix: emptyMatrix(),
      scoreDistribution: [2, 2, 1, 1],
      lossBucketCounts: Array(10).fill(0),
      lastGame: null,
    }),
  )
}

// Built through the real recorder rather than hand-rolled, so the stored shape
// can never drift from what the app actually writes.
function seedActivity() {
  let log: DailyActivityLog = {}
  log = recordGameResult(log, YESTERDAY, 18, ['day', 'week'])
  log = recordGameResult(log, YESTERDAY, 14, ['day'])
  log = recordGameResult(log, YESTERDAY, 14, [])
  log = recordGameResult(log, YESTERDAY, 9, [])
  log = recordGameResult(log, TODAY, 11, [])
  localStorage.setItem('order20-daily-activity', JSON.stringify(log))
}

async function openStats() {
  fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
  seedPlayedStats()
  seedActivity()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
})

describe('play history calendar', () => {
  it('makes a day you played into a button that says what happened', async () => {
    render(<App />)
    await openStats()

    const day = await screen.findByRole('button', { name: `${formatFullDateLabel(YESTERDAY)}, 4 games, best 18` })
    expect(day).toBeInTheDocument()
  })

  it('uses singular wording for a single game', async () => {
    render(<App />)
    await openStats()

    expect(await screen.findByRole('button', { name: `${formatFullDateLabel(TODAY)}, 1 game, best 11` })).toBeInTheDocument()
  })

  it('does not turn a day with no games into something tappable', async () => {
    render(<App />)
    await openStats()
    await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) })

    expect(screen.queryByRole('button', { name: new RegExp(formatFullDateLabel(QUIET_DAY)) })).not.toBeInTheDocument()
  })

  it('opens that day underneath, with every score best first', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) }))

    expect(await screen.findByText('Every score, best first')).toBeInTheDocument()
    const chips = document.querySelectorAll('.day-detail__chip')
    expect([...chips].map(chip => chip.textContent)).toEqual(['18', '14', '14', '9'])
  })

  it('shows the day total and its best', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) }))

    const detail = (await screen.findByText('Every score, best first')).closest('.day-detail') as HTMLElement
    expect(detail).toHaveTextContent('4')
    expect(detail).toHaveTextContent('games')
    expect(detail).toHaveTextContent('best that day')
  })

  it('reports leaderboard reach per window rather than as one total', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) }))

    // Two games hit the day board and one hit the week board; the counters are
    // independent, so summing them to "three" would be wrong.
    expect(await screen.findByText('2 reached the day board, 1 reached the week board.')).toBeInTheDocument()
  })

  it('says nothing about leaderboards on a day that reached none', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(TODAY)) }))

    await screen.findByText('Every score, best first')
    expect(screen.queryByText(/reached the/)).not.toBeInTheDocument()
  })

  it('closes when the same day is tapped again', async () => {
    render(<App />)
    await openStats()

    const day = await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) })
    fireEvent.click(day)
    expect(await screen.findByText('Every score, best first')).toBeInTheDocument()

    fireEvent.click(day)
    expect(screen.queryByText('Every score, best first')).not.toBeInTheDocument()
  })

  it('closes from the Close button', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) }))
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Every score, best first')).not.toBeInTheDocument()
  })

  it('switches straight to another day rather than needing a close first', async () => {
    render(<App />)
    await openStats()

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) }))
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(TODAY)) }))

    const chips = document.querySelectorAll('.day-detail__chip')
    expect([...chips].map(chip => chip.textContent)).toEqual(['11'])
  })

  it('marks the open day as pressed, for anyone not looking at the colours', async () => {
    render(<App />)
    await openStats()

    const day = await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) })
    expect(day).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(day)
    expect(day).toHaveAttribute('aria-pressed', 'true')
  })

  it('labels the columns with weekdays, starting Monday', async () => {
    render(<App />)
    await openStats()
    await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) })

    const dows = document.querySelector('.activity-cal__dows')
    expect([...(dows?.children ?? [])].map(child => child.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('puts each day in its real weekday column', async () => {
    render(<App />)
    await openStats()
    await screen.findByRole('button', { name: new RegExp(formatFullDateLabel(YESTERDAY)) })

    // Whatever today is, the grid must be a whole number of weeks wide, with
    // today sitting in its own weekday's column.
    const cells = document.querySelectorAll('.activity-cal .activity-cal__cell')
    const todayIndex = [...cells].findIndex(cell => cell.className.includes('activity-cal__cell--today'))
    const mondayFirst = (new Date(`${TODAY}T00:00:00Z`).getUTCDay() + 6) % 7

    expect(todayIndex % 7).toBe(mondayFirst)
  })
})
