import { sequenceColor } from './color'

const CELL_SIZE = 44
const CELL_GAP = 6
const PADDING = 36
const HEADER_HEIGHT = 92
const FOOTER_HEIGHT = 40

function gridColumns(size: number): number {
  return Math.max(1, Math.ceil(size / 10))
}

// Pure layout math, kept separate from the actual canvas drawing so it can
// be tested without a real canvas — jsdom doesn't implement one.
export function shareImageDimensions(size: number) {
  const columns = gridColumns(size)
  const rows = Math.ceil(size / columns)
  const gridWidth = columns * CELL_SIZE + (columns - 1) * CELL_GAP
  const gridHeight = rows * CELL_SIZE + (rows - 1) * CELL_GAP
  const width = gridWidth + PADDING * 2
  const height = HEADER_HEIGHT + gridHeight + FOOTER_HEIGHT + PADDING * 2
  return { width, height, columns, rows, gridWidth, gridHeight }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export interface ShareImageOptions {
  positions: (number | null)[]
  placedCount: number
  headline: string
  url: string
}

// Renders a branded PNG of the result grid — same sequence-color gradient
// as the real board rail — for sharing to places a plain text grid can't
// reach (Instagram/WhatsApp stories, etc). Returns null if canvas 2D isn't
// available, so callers can fall back to the existing text share.
export function buildShareImageBlob(options: ShareImageOptions): Promise<Blob | null> {
  const { positions, placedCount, headline, url } = options
  const size = positions.length
  const { width, height, columns, gridWidth } = shareImageDimensions(size)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.fillStyle = '#1f1533'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#b9aee0'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillText(headline.toUpperCase(), width / 2, PADDING + 16)

  ctx.fillStyle = '#f1edf9'
  ctx.font = '700 30px system-ui, sans-serif'
  ctx.fillText(`${placedCount} / ${size}`, width / 2, PADDING + 54)

  const gridStartX = (width - gridWidth) / 2
  const gridStartY = HEADER_HEIGHT + PADDING
  positions.forEach((value, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = gridStartX + col * (CELL_SIZE + CELL_GAP)
    const y = gridStartY + row * (CELL_SIZE + CELL_GAP)
    ctx.fillStyle = value !== null ? sequenceColor(size <= 1 ? 0 : index / (size - 1)) : 'rgba(241, 237, 249, 0.08)'
    drawRoundedRect(ctx, x, y, CELL_SIZE, CELL_SIZE, 10)
    ctx.fill()
  })

  ctx.fillStyle = '#7a7191'
  ctx.font = '400 13px system-ui, sans-serif'
  ctx.fillText(url, width / 2, height - PADDING / 2)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
