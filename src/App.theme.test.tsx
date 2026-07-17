import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { APP_VERSION } from './version'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  cleanup()
})

describe('theme', () => {
  it('defaults to dark when there is no stored preference', async () => {
    render(<App />)
    await screen.findByRole('button', { name: 'View stats' })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggling from the stats screen switches to light and back', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('order20-theme')).toBe('light')

    fireEvent.click(await screen.findByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('order20-theme')).toBe('dark')
  })

  it('remembers the choice across a refresh', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'View stats' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to light theme' }))

    cleanup()
    render(<App />)
    await screen.findByRole('button', { name: 'View stats' })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
