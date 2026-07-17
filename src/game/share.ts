import { BOARD_SIZE } from './types'

export function buildShareText(positions: (number | null)[], placedCount: number, won: boolean, url: string): string {
  const headline = won ? `Order 20 — perfect! ${BOARD_SIZE}/${BOARD_SIZE}` : `Order 20 — ${placedCount}/${BOARD_SIZE}`
  const grid = positions.map(value => (value !== null ? '🟧' : '⬜')).join('')
  return `${headline}\n${grid}\n${url}`
}
