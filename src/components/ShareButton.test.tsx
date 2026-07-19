import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from './ShareButton'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('ShareButton', () => {
  it('copies the share text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ShareButton positions={[10, null]} placedCount={1} won={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledOnce()
  })
})
