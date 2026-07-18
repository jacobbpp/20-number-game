import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildShareImageBlob, shareImageDimensions } from './shareImage'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('shareImageDimensions', () => {
  it('uses a single column for a 10-slot board', () => {
    expect(shareImageDimensions(10)).toMatchObject({ columns: 1, rows: 10, width: 116, height: 698 })
  })

  it('uses two columns for a 20-slot board', () => {
    expect(shareImageDimensions(20)).toMatchObject({ columns: 2, rows: 10, width: 166, height: 698 })
  })

  it('uses three columns for a 25-slot board', () => {
    expect(shareImageDimensions(25)).toMatchObject({ columns: 3, rows: 9, width: 216, height: 648 })
  })

  it('rounds row count up when the board size does not divide evenly by the column count', () => {
    // 15 slots / 2 columns = 7.5, must round up to 8 so nothing is clipped.
    expect(shareImageDimensions(15).rows).toBe(8)
  })
})

describe('buildShareImageBlob', () => {
  it('resolves null when canvas 2D context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const blob = await buildShareImageBlob({
      positions: [10, null],
      placedCount: 1,
      headline: 'Order 20',
      url: 'https://example.com/',
    })

    expect(blob).toBeNull()
  })

  it('resolves a PNG blob when canvas 2D is available', async () => {
    const fillRect = vi.fn()
    const fillText = vi.fn()
    const fill = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect,
      fillText,
      fill,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      callback(new Blob(['fake-png'], { type: 'image/png' }))
    })

    const blob = await buildShareImageBlob({
      positions: [10, null, 30],
      placedCount: 2,
      headline: 'Order 20',
      url: 'https://example.com/',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('image/png')
    // One fill per position (filled or empty — both render a cell).
    expect(fill).toHaveBeenCalledTimes(3)
    expect(fillText).toHaveBeenCalledWith('ORDER 20', expect.any(Number), expect.any(Number))
    expect(fillText).toHaveBeenCalledWith('2 / 3', expect.any(Number), expect.any(Number))
  })
})
