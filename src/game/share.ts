import type { StreakData } from './daily'

function buildGrid(positions: (number | null)[]): string {
  return positions.map(value => (value !== null ? '🟧' : '⬜')).join('')
}

export function buildShareText(positions: (number | null)[], placedCount: number, won: boolean, url: string): string {
  const size = positions.length
  const headline = won ? `Order 20: perfect! ${size}/${size}` : `Order 20: ${placedCount}/${size}`
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
  const size = positions.length
  const dateLabel = formatDailyDateLabel(dateString)
  const headline = won
    ? `Order 20 Daily (${dateLabel}): perfect! ${size}/${size}`
    : `Order 20 Daily (${dateLabel}): ${placedCount}/${size}`
  return `${headline}\n${buildGrid(positions)}\n${url}`
}

export function buildStreakShareText(streak: StreakData, url: string): string {
  return `🔥 ${streak.count} day streak on Order 20 Daily!\n${url}`
}
