import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RollDisplay } from './RollDisplay'

afterEach(cleanup)

describe('RollDisplay', () => {
  it('announces the rolled number in a live region', () => {
    render(<RollDisplay currentRoll={561} placedCount={0} total={20} />)
    const live = screen.getByText('Rolled 561', { selector: '[aria-live]' })
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('updates the live region text when the roll changes', () => {
    const { rerender } = render(<RollDisplay currentRoll={561} placedCount={0} total={20} />)
    screen.getByText('Rolled 561', { selector: '[aria-live]' })

    rerender(<RollDisplay currentRoll={82} placedCount={1} total={20} />)
    expect(screen.getByText('Rolled 82', { selector: '[aria-live]' })).toBeInTheDocument()
    expect(screen.queryByText('Rolled 561', { selector: '[aria-live]' })).not.toBeInTheDocument()
  })

  it('gives the visible tile a clear accessible name too', () => {
    render(<RollDisplay currentRoll={561} placedCount={0} total={20} />)
    expect(screen.getByLabelText('Rolled 561')).toHaveTextContent('561')
  })

  it('has no rolled-number text in the live region before the first roll', () => {
    render(<RollDisplay currentRoll={null} placedCount={0} total={20} />)
    const live = document.querySelector('[aria-live]')
    expect(live).toHaveTextContent('')
  })
})
