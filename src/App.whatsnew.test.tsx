import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { CHANGELOG } from './changelog'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe("App what's new", () => {
  it('does not show to a brand new player, and stays caught up after onboarding', async () => {
    render(<App />)

    // Fresh install: onboarding shows, not What's New.
    await screen.findByRole('heading', { name: 'How to play' })
    expect(screen.queryByRole('heading', { name: "What's new" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

    // Dismissing onboarding shouldn't surface a backlog of updates for
    // versions this player never actually played.
    expect(screen.queryByRole('heading', { name: "What's new" })).not.toBeInTheDocument()
  })

  it('shows the full changelog to a returning player with no recorded seen version', async () => {
    localStorage.setItem('order20-onboarded', '1')
    render(<App />)

    const dialog = await screen.findByRole('alertdialog', { name: "What's new" })
    // The newest entry is the headline.
    expect(within(dialog).getByText(`v${CHANGELOG[0].version}`)).toBeInTheDocument()
    expect(within(dialog).getByText(CHANGELOG[0].title)).toBeInTheDocument()
    // Everything else is listed below.
    expect(within(dialog).getByText(CHANGELOG[CHANGELOG.length - 1].title)).toBeInTheDocument()
  })

  it('only shows entries newer than the last version the player saw', async () => {
    localStorage.setItem('order20-onboarded', '1')
    const oldSeenVersion = CHANGELOG[2].version
    localStorage.setItem('order20-whatsnew-seen-version', oldSeenVersion)
    render(<App />)

    const dialog = await screen.findByRole('alertdialog', { name: "What's new" })
    expect(within(dialog).getByText(CHANGELOG[0].title)).toBeInTheDocument()
    expect(within(dialog).getByText(CHANGELOG[1].title)).toBeInTheDocument()
    expect(within(dialog).queryByText(CHANGELOG[2].title)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(CHANGELOG[CHANGELOG.length - 1].title)).not.toBeInTheDocument()
  })

  it('does not reopen after being dismissed', async () => {
    localStorage.setItem('order20-onboarded', '1')
    render(<App />)

    await screen.findByRole('alertdialog', { name: "What's new" })
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(screen.queryByRole('alertdialog', { name: "What's new" })).not.toBeInTheDocument()
    cleanup()

    render(<App />)
    expect(screen.queryByRole('alertdialog', { name: "What's new" })).not.toBeInTheDocument()
  })
})
