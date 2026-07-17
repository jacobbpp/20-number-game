import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
  localStorage.clear()
})

describe('ErrorBoundary', () => {
  it('clears every order20- prefixed key on reset, not just a hardcoded subset', () => {
    localStorage.setItem('order20-best-score', '16')
    localStorage.setItem('order20-stats', '{}')
    localStorage.setItem('order20-current-game', '{}')
    localStorage.setItem('order20-daily-streak', '3')
    localStorage.setItem('order20-theme', 'light')
    localStorage.setItem('unrelated-key', 'keep-me')

    const reloadMock = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadMock })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset and reload' }))

    expect(localStorage.getItem('order20-best-score')).toBeNull()
    expect(localStorage.getItem('order20-stats')).toBeNull()
    expect(localStorage.getItem('order20-current-game')).toBeNull()
    expect(localStorage.getItem('order20-daily-streak')).toBeNull()
    expect(localStorage.getItem('order20-theme')).toBeNull()
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me')
    expect(reloadMock).toHaveBeenCalledOnce()
  })

  it('renders children normally when nothing has thrown', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
