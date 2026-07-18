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

  it('summarizes insights by default without listing every pattern', async () => {
    render(<App />)
    await openGuide()

    expect(await screen.findByText('Insights')).toBeInTheDocument()
    expect(screen.queryByText('Best position')).not.toBeInTheDocument()
    expect(screen.queryByText('Board half')).not.toBeInTheDocument()
  })

  it('expands to show every insight pattern individually when tapped', async () => {
    render(<App />)
    await openGuide()

    fireEvent.click(await screen.findByRole('button', { name: 'See each pattern' }))

    expect(screen.getByText('Best position')).toBeInTheDocument()
    expect(screen.getByText('Board half')).toBeInTheDocument()
    expect(screen.getByText('Streak momentum')).toBeInTheDocument()
    expect(screen.getByText('Last game')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide each pattern' }))
    expect(screen.queryByText('Best position')).not.toBeInTheDocument()
  })

  it('returns to settings, not the game, when backing out', async () => {
    render(<App />)
    await openGuide()

    fireEvent.click(await screen.findByRole('button', { name: 'Back to settings' }))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learn about the app/ })).toBeInTheDocument()
  })
})
