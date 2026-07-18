import type { Theme } from '../hooks/useTheme'

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

// Mirrors index.css's --bg/--text/--slot-filled/--text-disabled tokens for
// each theme, so the exported image matches whichever look the player is
// actually using rather than always rendering dark.
const PALETTES: Record<Theme, {
  bg: string
  headline: string
  scoreText: string
  filledCellBg: string
  filledText: string
  emptyCellBg: string
  emptyText: string
  urlText: string
}> = {
  dark: {
    bg: '#16131b',
    headline: '#c4bdd0',
    scoreText: '#ece8f2',
    filledCellBg: '#1b1722',
    filledText: '#ece8f2',
    emptyCellBg: 'rgba(236, 232, 242, 0.05)',
    emptyText: '#9a94a6',
    urlText: '#9a94a6',
  },
  light: {
    bg: '#f3f0ec',
    headline: '#3f3a48',
    scoreText: '#1d1a24',
    filledCellBg: '#faf8f4',
    filledText: '#1d1a24',
    emptyCellBg: 'rgba(29, 26, 36, 0.05)',
    emptyText: '#7a7482',
    urlText: '#7a7482',
  },
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
  theme: Theme
}

// Renders a branded PNG matching ResultGrid's own look (same wide pill
// rows, same filled/empty colors) so a shared image reads as unmistakably
// "a screenshot of this app" rather than a separate visual language.
// Returns null if canvas 2D isn't available, so callers can fall back to
// the existing text share.
export function buildShareImageBlob(options: ShareImageOptions): Promise<Blob | null> {
  const { positions, placedCount, won, headline, url, theme } = options
  const size = positions.length
  const { width, height, rows, gridWidth } = shareImageDimensions(size)
  const palette = PALETTES[theme]

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.headline
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.fillText(headline.toUpperCase(), width / 2, PADDING + 12)

  ctx.fillStyle = palette.scoreText
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

    ctx.fillStyle = filled ? palette.filledCellBg : palette.emptyCellBg
    drawRoundedRect(ctx, x, y, CELL_WIDTH, CELL_HEIGHT, 6)
    ctx.fill()

    ctx.fillStyle = filled ? palette.filledText : palette.emptyText
    ctx.font = '600 10px system-ui, sans-serif'
    ctx.fillText(String(index + 1), x + 10, y + CELL_HEIGHT / 2)

    ctx.font = '600 13px system-ui, sans-serif'
    ctx.fillText(filled ? String(value) : '—', x + 30, y + CELL_HEIGHT / 2)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = palette.urlText
  ctx.font = '400 11px system-ui, sans-serif'
  ctx.fillText(url, width / 2, height - PADDING / 2)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
