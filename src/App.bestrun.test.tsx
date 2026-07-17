import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { APP_VERSION } from './version'

function valueForRoll(n: number) {
  return (n - 1) / 1000
}

function mockRollSequence(values: number[]) {
  let i = 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const n = values[Math.min(i, values.length - 1)]
    i += 1
    return valueForRoll(n)
  })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('best run', () => {
  it('shows a friendly empty state for a player who has never set a best', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Best 0/ }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Your best' })
    expect(within(dialog).getByText(/Play a game to set your first best/)).toBeInTheDocument()
  })

  it('shows a "predates this feature" message for an existing nonzero best with no saved board', async () => {
    localStorage.setItem('order20-best-score', '16')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Best 16/ }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Your best' })
    expect(within(dialog).getByText(/no board saved/)).toBeInTheDocument()
  })

  it('saves the board for a new best and shows it when reopened', async () => {
    mockRollSequence([64, 75, 63])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))
    await screen.findByRole('heading', { name: 'Game over' })

    fireEvent.click(screen.getByRole('button', { name: /Best 2/ }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Your best' })
    expect(within(dialog).getByText('64')).toBeInTheDocument()
    expect(within(dialog).getByText('75')).toBeInTheDocument()
  })

  it('replaces the saved board when a strictly higher best is set', async () => {
    mockRollSequence([64, 75, 63])
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))
    await screen.findByRole('heading', { name: 'Game over' })

    // Set up the next sequence before restarting — the restart itself
    // triggers the first roll of the new game synchronously.
    mockRollSequence([100, 200, 300, 150])
    fireEvent.click(screen.getByRole('button', { name: 'New game' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 1, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 2, empty, valid placement' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Position 3, empty, valid placement' }))
    await screen.findByRole('heading', { name: 'Game over' })

    fireEvent.click(screen.getByRole('button', { name: /Best 3/ }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Your best' })
    expect(within(dialog).getByText('100')).toBeInTheDocument()
    expect(within(dialog).queryByText('64')).not.toBeInTheDocument()
  })
})
