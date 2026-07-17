import { BOARD_SIZE } from './types'

export const VALUE_BUCKETS = 10
export const BUCKET_SIZE = 1000 / VALUE_BUCKETS
const MIN_SIGNAL = 2
const MIN_GAMES_FOR_INSIGHT = 3

export interface Placement {
  position: number
  value: number
}

export interface LastGameRecord {
  placements: Placement[]
  result: 'won' | 'lost'
  timestamp: number
}

export interface StatsData {
  totalGames: number
  matrix: number[][] // matrix[position][bucket]
  lastGame: LastGameRecord | null
}

export function createEmptyMatrix(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(VALUE_BUCKETS).fill(0))
}

export function createEmptyStats(): StatsData {
  return { totalGames: 0, matrix: createEmptyMatrix(), lastGame: null }
}

export function bucketForValue(value: number): number {
  return Math.min(VALUE_BUCKETS - 1, Math.floor((value - 1) / BUCKET_SIZE))
}

export function bucketLabel(bucket: number): string {
  const start = bucket * BUCKET_SIZE + 1
  const end = (bucket + 1) * BUCKET_SIZE
  return `${start}–${end}`
}

export function extractPlacements(positions: (number | null)[]): Placement[] {
  const placements: Placement[] = []
  positions.forEach((value, position) => {
    if (value !== null) placements.push({ position, value })
  })
  return placements
}

export function recordGame(stats: StatsData, placements: Placement[], result: 'won' | 'lost'): StatsData {
  const matrix = stats.matrix.map(row => [...row])
  for (const { position, value } of placements) {
    matrix[position][bucketForValue(value)] += 1
  }
  return {
    totalGames: stats.totalGames + 1,
    matrix,
    lastGame: { placements, result, timestamp: Date.now() },
  }
}

export function maxCount(matrix: number[][]): number {
  let max = 0
  for (const row of matrix) {
    for (const count of row) {
      if (count > max) max = count
    }
  }
  return max
}

export interface Insight {
  kind: 'match' | 'mismatch'
  position: number
  value: number
  bucket: number
  usualPosition: number
}

export function computeInsight(stats: StatsData): Insight | null {
  const { matrix, lastGame, totalGames } = stats
  if (!lastGame || totalGames < MIN_GAMES_FOR_INSIGHT) return null

  const candidates = lastGame.placements
    .map(({ position, value }) => {
      const bucket = bucketForValue(value)
      // matrix already includes this exact placement (recordGame updates the
      // matrix and sets lastGame together), so exclude its own +1 here —
      // otherwise a single prior occurrence plus this game reads as "usually
      // lands here" when there's really only one real precedent.
      const column = matrix.map(row => row[bucket])
      column[position] = Math.max(0, column[position] - 1)

      let usualPosition = 0
      for (let i = 1; i < column.length; i++) {
        if (column[i] > column[usualPosition]) usualPosition = i
      }
      return { position, value, bucket, usualPosition, usualCount: column[usualPosition], actualCount: column[position] }
    })
    .filter(c => c.usualCount >= MIN_SIGNAL)

  if (candidates.length === 0) return null

  const mismatches = candidates.filter(c => c.usualPosition !== c.position)
  if (mismatches.length > 0) {
    const top = mismatches.reduce((a, b) => (b.usualCount - b.actualCount > a.usualCount - a.actualCount ? b : a))
    return { kind: 'mismatch', position: top.position, value: top.value, bucket: top.bucket, usualPosition: top.usualPosition }
  }

  const top = candidates.reduce((a, b) => (b.usualCount > a.usualCount ? b : a))
  return { kind: 'match', position: top.position, value: top.value, bucket: top.bucket, usualPosition: top.usualPosition }
}

export function describeInsight(insight: Insight): string {
  const range = bucketLabel(insight.bucket)
  const actualLabel = `position ${insight.position + 1}`
  if (insight.kind === 'match') {
    return `${insight.value} landed at ${actualLabel}, right where numbers in the ${range} range usually go.`
  }
  const usualLabel = `position ${insight.usualPosition + 1}`
  return `Numbers in the ${range} range usually land at ${usualLabel} — but this time ${insight.value} landed at ${actualLabel}.`
}
