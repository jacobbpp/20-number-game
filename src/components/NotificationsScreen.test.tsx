import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationsScreen } from './NotificationsScreen'

function renderScreen(overrides: Partial<Parameters<typeof NotificationsScreen>[0]> = {}) {
  const props = {
    availability: 'available' as const,
    enabled: false,
    busy: false,
    error: null,
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<NotificationsScreen {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('when the reminder can be turned on', () => {
  it('offers a switch that reads as off', () => {
    renderScreen()

    expect(screen.getByRole('switch', { name: 'Daily reminder' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('turns it on from the switch', () => {
    const props = renderScreen()

    fireEvent.click(screen.getByRole('switch', { name: 'Daily reminder' }))

    expect(props.onEnable).toHaveBeenCalledOnce()
    expect(props.onDisable).not.toHaveBeenCalled()
  })

  it('turns it off again rather than asking twice', () => {
    const props = renderScreen({ enabled: true })

    expect(screen.getByRole('switch', { name: 'Daily reminder' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch', { name: 'Daily reminder' }))

    expect(props.onDisable).toHaveBeenCalledOnce()
    expect(props.onEnable).not.toHaveBeenCalled()
  })

  it('cannot be pressed twice while it is still working', () => {
    renderScreen({ busy: true })

    expect(screen.getByRole('switch', { name: 'Daily reminder' })).toBeDisabled()
    expect(screen.getByText('Just a moment')).toBeInTheDocument()
  })

  it('says when it will arrive and what it will not do', () => {
    renderScreen()

    expect(screen.getByText(/One notification a day, at 9am/)).toBeInTheDocument()
    expect(screen.getByText(/No alerts when somebody beats you/)).toBeInTheDocument()
  })

  it('shows a problem instead of silently doing nothing', () => {
    renderScreen({ error: 'Could not turn the reminder on. Try again in a moment.' })

    expect(screen.getByText(/Could not turn the reminder on/)).toBeInTheDocument()
  })
})

describe('when the app is not on the Home Screen yet', () => {
  it('explains what to do rather than offering a switch that would fail', () => {
    renderScreen({ availability: 'needs-install' })

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/Add Order 20 to your Home Screen first/)).toBeInTheDocument()
  })

  it('walks through it in numbered steps with a picture each', () => {
    renderScreen({ availability: 'needs-install' })

    expect(screen.getByText('Tap Share in Safari')).toBeInTheDocument()
    expect(screen.getByText('Choose Add to Home Screen')).toBeInTheDocument()
    expect(screen.getByText('Open it from the icon')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })
})

describe('when the answer is already no', () => {
  it('says a refusal has to be undone in the browser, not here', () => {
    renderScreen({ availability: 'blocked' })

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/Notifications are turned off for this app/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone from here/)).toBeInTheDocument()
  })

  it('reassures rather than alarms when the browser simply cannot', () => {
    renderScreen({ availability: 'unsupported' })

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/This browser cannot do reminders/)).toBeInTheDocument()
    expect(screen.getByText(/Nothing is wrong/)).toBeInTheDocument()
  })
})

describe('getting back', () => {
  it('closes from the header', () => {
    const props = renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Back to settings' }))

    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
