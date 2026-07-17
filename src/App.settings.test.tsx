import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { CHANGELOG } from './changelog'
import { APP_VERSION } from './version'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

describe('settings screen', () => {
  it('opens from the header gear icon and shows sound and theme rows', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mute sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('replaces the mute toggle in the header with a single settings icon', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'Settings' })
    expect(screen.queryByRole('button', { name: 'Mute sound' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unmute sound' })).not.toBeInTheDocument()
  })

  it('toggling mute from settings persists and is reflected after navigating back', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mute sound' }))

    expect(localStorage.getItem('order20-sound-muted')).toBe('1')
    expect(await screen.findByRole('button', { name: 'Unmute sound' })).toBeInTheDocument()
  })

  it('closes back to the board via the back button', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Back to game' }))

    expect(await screen.findByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByText(/Reset all data/)).not.toBeInTheDocument()
  })

  it('shows the current version, and opens the full changelog — not just unseen entries — when tapped', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    const versionButton = await screen.findByRole('button', { name: `Version ${APP_VERSION}. View release notes` })
    expect(versionButton).toHaveTextContent(`v${APP_VERSION}`)

    fireEvent.click(versionButton)

    // Every version already "seen" per beforeEach — a real What's New popup
    // would show nothing. This one shows the full history regardless.
    const latest = CHANGELOG[0]
    const older = CHANGELOG[CHANGELOG.length - 1]
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText("What's new")).toBeInTheDocument()
    expect(within(dialog).getByText(latest.title)).toBeInTheDocument()
    expect(within(dialog).getByText(`v${older.version}`)).toBeInTheDocument()
    expect(within(dialog).getByText(older.title)).toBeInTheDocument()
  })
})
