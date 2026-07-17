import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function TrapPanel() {
  const containerRef = useFocusTrap<HTMLDivElement>()
  return (
    <div ref={containerRef} data-testid="panel">
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  )
}

function Harness({ show }: { show: boolean }) {
  return (
    <div>
      <button type="button">Outside trigger</button>
      {show && <TrapPanel />}
    </div>
  )
}

afterEach(cleanup)

describe('useFocusTrap', () => {
  it('wraps Shift+Tab from the first focusable element to the last', () => {
    const { getByText } = render(<Harness show />)
    const first = getByText('First')
    const last = getByText('Last')

    first.focus()
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('wraps Tab from the last focusable element back to the first', () => {
    const { getByText } = render(<Harness show />)
    const first = getByText('First')
    const last = getByText('Last')

    last.focus()
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('restores focus to whatever was focused before the trap mounted', () => {
    const { getByText, rerender } = render(<Harness show={false} />)
    const trigger = getByText('Outside trigger')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    act(() => {
      rerender(<Harness show />)
    })
    const first = getByText('First')
    first.focus()
    expect(document.activeElement).toBe(first)

    act(() => {
      rerender(<Harness show={false} />)
    })
    expect(document.activeElement).toBe(trigger)
  })
})
