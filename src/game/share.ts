import { BOARD_SIZE } from './types'

function buildGrid(positions: (number | null)[]): string {
  return positions.map(value => (value !== null ? '🟧' : '⬜')).join('')
}

export function buildShareText(positions: (number | null)[], placedCount: number, won: boolean, url: string): string {
  const headline = won ? `Order 20 — perfect! ${BOARD_SIZE}/${BOARD_SIZE}` : `Order 20 — ${placedCount}/${BOARD_SIZE}`
  return `${headline}\n${buildGrid(positions)}\n${url}`
}

export function formatDailyDateLabel(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function buildDailyShareText(
  positions: (number | null)[],
  placedCount: number,
  won: boolean,
  dateString: string,
  url: string,
): string {
  const dateLabel = formatDailyDateLabel(dateString)
  const headline = won
    ? `Order 20 Daily (${dateLabel}) — perfect! ${BOARD_SIZE}/${BOARD_SIZE}`
    : `Order 20 Daily (${dateLabel}) — ${placedCount}/${BOARD_SIZE}`
  return `${headline}\n${buildGrid(positions)}\n${url}`
}
