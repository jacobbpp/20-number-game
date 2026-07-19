import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PositionSlot } from './PositionSlot'

afterEach(() => {
  cleanup()
})

describe('PositionSlot in normal mode', () => {
  it('highlights a valid empty slot and disables an invalid one', () => {
    const onSelect = vi.fn()
    render(
      <>
        <PositionSlot index={0} value={null} isValid onSelect={onSelect} hardMode={false} isSuggested={false} accentColor="#000" />
        <PositionSlot index={1} value={null} isValid={false} onSelect={onSelect} hardMode={false} isSuggested={false} accentColor="#000" />
      </>,
    )

    const validSlot = screen.getByRole('button', { name: 'Position 1, empty, valid placement' })
    expect(validSlot).toHaveTextContent('tap')
    expect(validSlot).not.toBeDisabled()

    const invalidSlot = screen.getByRole('button', { name: 'Position 2, empty, not a valid placement' })
    expect(invalidSlot).toBeDisabled()
  })

  it('marks the suggested valid slot with a "usual spot" note and a visible marker', () => {
    render(
      <PositionSlot index={4} value={null} isValid onSelect={vi.fn()} hardMode={false} isSuggested accentColor="#000" />,
    )

    const slot = screen.getByRole('button', { name: 'Position 5, empty, valid placement, where players usually place this range' })
    expect(slot.querySelector('.slot__suggested')).not.toBeNull()
  })

  it('does not mark an invalid slot as suggested even if isSuggested is somehow true', () => {
    render(
      <PositionSlot index={4} value={null} isValid={false} onSelect={vi.fn()} hardMode={false} isSuggested accentColor="#000" />,
    )

    const slot = screen.getByRole('button', { name: 'Position 5, empty, not a valid placement' })
    expect(slot.querySelector('.slot__suggested')).toBeNull()
  })
})

describe('PositionSlot in hard mode', () => {
  it('renders valid and invalid empty slots identically, both tappable', () => {
    render(
      <>
        <PositionSlot index={0} value={null} isValid onSelect={vi.fn()} hardMode isSuggested={false} accentColor="#000" />
        <PositionSlot index={1} value={null} isValid={false} onSelect={vi.fn()} hardMode isSuggested={false} accentColor="#000" />
      </>,
    )

    const slotOne = screen.getByRole('button', { name: 'Position 1, empty' })
    const slotTwo = screen.getByRole('button', { name: 'Position 2, empty' })
    expect(slotOne).toHaveTextContent('tap')
    expect(slotTwo).toHaveTextContent('tap')
    expect(slotOne).not.toBeDisabled()
    expect(slotTwo).not.toBeDisabled()
    expect(slotOne.className).not.toContain('slot--valid')
    expect(slotTwo.className).not.toContain('slot--valid')
  })

  it('still calls onSelect when a hard-mode slot is tapped, valid or not', () => {
    const onSelect = vi.fn()
    render(<PositionSlot index={4} value={null} isValid={false} onSelect={onSelect} hardMode isSuggested={false} accentColor="#000" />)

    fireEvent.click(screen.getByRole('button', { name: 'Position 5, empty' }))
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it('does not disguise a filled slot as tappable', () => {
    render(<PositionSlot index={2} value={57} isValid={false} onSelect={vi.fn()} hardMode isSuggested={false} accentColor="#000" />)

    const slot = screen.getByRole('button', { name: 'Position 3, filled with 57' })
    expect(slot).toBeDisabled()
    expect(slot).toHaveTextContent('57')
  })

  it('never shows the suggestion marker or note in hard mode, even if isSuggested is true', () => {
    render(
      <PositionSlot index={4} value={null} isValid onSelect={vi.fn()} hardMode isSuggested accentColor="#000" />,
    )

    const slot = screen.getByRole('button', { name: 'Position 5, empty' })
    expect(slot.querySelector('.slot__suggested')).toBeNull()
  })
})
