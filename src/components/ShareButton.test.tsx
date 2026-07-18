import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from './ShareButton'

function mockCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    fillText: vi.fn(),
    fill: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
    callback(new Blob(['fake-png'], { type: 'image/png' }))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
})

describe('ShareButton', () => {
  it('falls back to copying text when the browser has no file-share support', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ShareButton positions={[10, null]} placedCount={1} won={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledOnce()
  })

  it('shares a generated image via the native share sheet when files are supported', async () => {
    mockCanvas()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    Object.assign(navigator, { clipboard: { writeText }, share, canShare })

    render(<ShareButton positions={[10, null]} placedCount={1} won={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await vi.waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ files: [expect.any(File)], text: expect.any(String) }),
    )
    // The native share sheet handled it — no clipboard fallback needed.
    expect(writeText).not.toHaveBeenCalled()
  })

  it('does not fall back to copying when the player cancels the share sheet', async () => {
    mockCanvas()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const abortError = new DOMException('canceled', 'AbortError')
    const share = vi.fn().mockRejectedValue(abortError)
    const canShare = vi.fn().mockReturnValue(true)
    Object.assign(navigator, { clipboard: { writeText }, share, canShare })

    render(<ShareButton positions={[10, null]} placedCount={1} won={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await vi.waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument()
  })

  it('falls back to copying text when the native share call fails for another reason', async () => {
    mockCanvas()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const share = vi.fn().mockRejectedValue(new Error('permission denied'))
    const canShare = vi.fn().mockReturnValue(true)
    Object.assign(navigator, { clipboard: { writeText }, share, canShare })

    render(<ShareButton positions={[10, null]} placedCount={1} won={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledOnce()
  })
})
