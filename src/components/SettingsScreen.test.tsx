import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from './SettingsScreen'

function renderScreen(overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) {
  const props = {
    muted: false,
    onToggleMuted: vi.fn(),
    theme: 'dark' as const,
    onToggleTheme: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SettingsScreen {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
  localStorage.clear()
})

describe('SettingsScreen', () => {
  it('calls onToggleMuted from the sound row', () => {
    const props = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }))
    expect(props.onToggleMuted).toHaveBeenCalledOnce()
  })

  it('calls onToggleTheme from the theme row', () => {
    const props = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(props.onToggleTheme).toHaveBeenCalledOnce()
  })

  it('requires a second tap before resetting data', () => {
    renderScreen()

    expect(screen.queryByText(/Reset everything\?/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))
    expect(screen.getByText(/Reset everything\?/)).toBeInTheDocument()
  })

  it('moves focus to Cancel — the safe option — when the confirm step appears', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('cancel backs out without touching localStorage', () => {
    localStorage.setItem('order20-best-score', '16')
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText(/Reset everything\?/)).not.toBeInTheDocument()
    expect(localStorage.getItem('order20-best-score')).toBe('16')
  })

  it('confirming clears every order20- key and reloads', () => {
    localStorage.setItem('order20-best-score', '16')
    localStorage.setItem('order20-stats', '{}')
    localStorage.setItem('order20-theme', 'light')
    localStorage.setItem('unrelated-key', 'keep-me')

    const reloadMock = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadMock })

    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Reset all data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, reset' }))

    expect(localStorage.getItem('order20-best-score')).toBeNull()
    expect(localStorage.getItem('order20-stats')).toBeNull()
    expect(localStorage.getItem('order20-theme')).toBeNull()
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me')
    expect(reloadMock).toHaveBeenCalledOnce()
  })
})
