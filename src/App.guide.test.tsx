import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { APP_VERSION } from './version'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

async function openGuide() {
  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
  fireEvent.click(await screen.findByRole('button', { name: /Learn about the app/ }))
}

describe('guide screen', () => {
  it('opens from the settings screen and lists stats and settings sections', async () => {
    render(<App />)
    await openGuide()

    expect(await screen.findByText('Guide')).toBeInTheDocument()
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Heatmap')).toBeInTheDocument()
    expect(screen.getByText('Hard mode')).toBeInTheDocument()
    expect(screen.getByText('Reset all data')).toBeInTheDocument()
  })

  it('lists the insights panels directly, with no pattern cards left to hide behind a toggle', async () => {
    render(<App />)
    await openGuide()

    expect(await screen.findByText('Last 24 hours')).toBeInTheDocument()
    expect(screen.getByText('Leaderboard reach')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'See each pattern' })).not.toBeInTheDocument()
  })

  it('has nothing left to say about the pattern cards that were removed from Stats', async () => {
    render(<App />)
    await openGuide()

    await screen.findByText('Last 24 hours')
    expect(screen.queryByText('Best position')).not.toBeInTheDocument()
    expect(screen.queryByText('Board half')).not.toBeInTheDocument()
    expect(screen.queryByText('Streak momentum')).not.toBeInTheDocument()
    expect(screen.queryByText('Signature position')).not.toBeInTheDocument()
    expect(screen.queryByText('Closest calls')).not.toBeInTheDocument()
  })

  it('returns to settings, not the game, when backing out', async () => {
    render(<App />)
    await openGuide()

    fireEvent.click(await screen.findByRole('button', { name: 'Back to settings' }))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learn about the app/ })).toBeInTheDocument()
  })
})
