const CELL_HEIGHT = 34
const CELL_GAP = 6
const COLUMN_GAP = 10
const CELL_WIDTH = 130
const PADDING = 20
const HEADER_HEIGHT = 56
const FOOTER_HEIGHT = 24
// Renders at 2x and scales the context down, so the exported PNG stays
// crisp rather than blurry when viewed full-size or on a high-DPI screen.
const SCALE = 2

function gridColumns(size: number): number {
  return Math.max(1, Math.ceil(size / 10))
}

// Pure layout math, kept separate from the actual canvas drawing so it can
// be tested without a real canvas — jsdom doesn't implement one. Mirrors
// ResultGrid's own column-major layout (grid-auto-flow: column): index 0
// fills the top of column 0, working down before moving to column 1.
export function shareImageDimensions(size: number) {
  const columns = gridColumns(size)
  const rows = Math.ceil(size / columns)
  const gridWidth = columns * CELL_WIDTH + (columns - 1) * COLUMN_GAP
  const gridHeight = rows * CELL_HEIGHT + (rows - 1) * CELL_GAP
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
  won: boolean
  headline: string
  url: string
}

// Renders a branded PNG matching ResultGrid's own look (same wide pill
// rows, same filled/empty colors) so a shared image reads as unmistakably
// "a screenshot of this app" rather than a separate visual language.
// Returns null if canvas 2D isn't available, so callers can fall back to
// the existing text share.
export function buildShareImageBlob(options: ShareImageOptions): Promise<Blob | null> {
  const { positions, placedCount, won, headline, url } = options
  const size = positions.length
  const { width, height, rows, gridWidth } = shareImageDimensions(size)

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = '#1f1533'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#b9aee0'
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.fillText(headline.toUpperCase(), width / 2, PADDING + 12)

  ctx.fillStyle = '#f1edf9'
  ctx.font = '700 22px system-ui, sans-serif'
  ctx.fillText(won ? `Perfect ${placedCount}/${size}!` : `${placedCount} / ${size}`, width / 2, PADDING + 40)

  const gridStartX = (width - gridWidth) / 2
  const gridStartY = HEADER_HEIGHT + PADDING

  ctx.textAlign = 'left'
  positions.forEach((value, index) => {
    const col = Math.floor(index / rows)
    const row = index % rows
    const x = gridStartX + col * (CELL_WIDTH + COLUMN_GAP)
    const y = gridStartY + row * (CELL_HEIGHT + CELL_GAP)
    const filled = value !== null

    ctx.fillStyle = filled ? '#26215c' : 'rgba(241, 237, 249, 0.05)'
    drawRoundedRect(ctx, x, y, CELL_WIDTH, CELL_HEIGHT, 6)
    ctx.fill()

    ctx.fillStyle = filled ? '#f1edf9' : '#7a7191'
    ctx.font = '600 10px system-ui, sans-serif'
    ctx.fillText(String(index + 1), x + 10, y + CELL_HEIGHT / 2)

    ctx.font = '600 13px system-ui, sans-serif'
    ctx.fillText(filled ? String(value) : '—', x + 30, y + CELL_HEIGHT / 2)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#7a7191'
  ctx.font = '400 11px system-ui, sans-serif'
  ctx.fillText(url, width / 2, height - PADDING / 2)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
