import { BOARD_SIZE } from './types'

export const VALUE_BUCKETS = 10
export const BUCKET_SIZE = 1000 / VALUE_BUCKETS
export const SCORE_BUCKETS = 4
const MIN_SIGNAL = 2
const MIN_GAMES_FOR_INSIGHT = 3
const MIN_LOSSES_FOR_LOSS_INSIGHT = 3

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
  totalWins: number
  totalTurns: number
  winTurns: number // sum of placements across won games only, for average-turns-in-wins
  currentWinStreak: number // consecutive wins, resets to 0 on any loss
  bestWinStreak: number // longest currentWinStreak has ever reached
  hardModeWins: number // wins recorded while hard mode was on
  scoreDistribution: number[] // placedCount bucketed into SCORE_BUCKETS ranges, across all games
  matrix: number[][] // matrix[position][bucket], across all games
  winMatrix: number[][] // same shape, won games only
  lossMatrix: number[][] // same shape, lost games only
  lossBucketCounts: number[] // value bucket of the roll that ended each lost game
  lastGame: LastGameRecord | null
}

export function createEmptyMatrix(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(VALUE_BUCKETS).fill(0))
}

export function createEmptyLossBucketCounts(): number[] {
  return Array(VALUE_BUCKETS).fill(0)
}

export function createEmptyScoreDistribution(): number[] {
  return Array(SCORE_BUCKETS).fill(0)
}

export function createEmptyStats(): StatsData {
  return {
    totalGames: 0,
    totalWins: 0,
    totalTurns: 0,
    winTurns: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    hardModeWins: 0,
    scoreDistribution: createEmptyScoreDistribution(),
    matrix: createEmptyMatrix(),
    winMatrix: createEmptyMatrix(),
    lossMatrix: createEmptyMatrix(),
    lossBucketCounts: createEmptyLossBucketCounts(),
    lastGame: null,
  }
}

export function bucketForValue(value: number): number {
  return Math.min(VALUE_BUCKETS - 1, Math.floor((value - 1) / BUCKET_SIZE))
}

export function bucketLabel(bucket: number): string {
  const start = bucket * BUCKET_SIZE + 1
  const end = (bucket + 1) * BUCKET_SIZE
  return `${start}–${end}`
}

// total is the board size the game was actually played on (free play is
// always BOARD_SIZE today, but this stays correct if that ever changes).
export function scoreBucketForCount(placedCount: number, total: number): number {
  const bucketSize = total / SCORE_BUCKETS
  return Math.min(SCORE_BUCKETS - 1, Math.floor(placedCount / bucketSize))
}

export function scoreBucketLabel(bucket: number, total: number): string {
  const bucketSize = total / SCORE_BUCKETS
  const start = Math.round(bucket * bucketSize) + (bucket === 0 ? 0 : 1)
  const end = Math.round((bucket + 1) * bucketSize)
  return `${start}–${end}`
}

// A spoken/screen-reader equivalent of the score-distribution bar chart,
// which otherwise conveys its values purely through bar height.
export function describeScoreDistribution(distribution: number[], total: number): string {
  return distribution
    .map((count, bucket) => `${count} game${count === 1 ? '' : 's'} placed ${scoreBucketLabel(bucket, total)}`)
    .join(', ')
}

export function extractPlacements(positions: (number | null)[]): Placement[] {
  const placements: Placement[] = []
  positions.forEach((value, position) => {
    if (value !== null) placements.push({ position, value })
  })
  return placements
}

export function recordGame(
  stats: StatsData,
  placements: Placement[],
  result: 'won' | 'lost',
  losingValue: number | null = null,
  total: number = BOARD_SIZE,
  hardMode: boolean = false,
): StatsData {
  const matrix = stats.matrix.map(row => [...row])
  const winMatrix = stats.winMatrix.map(row => [...row])
  const lossMatrix = stats.lossMatrix.map(row => [...row])
  const resultMatrix = result === 'won' ? winMatrix : lossMatrix
  for (const { position, value } of placements) {
    const bucket = bucketForValue(value)
    matrix[position][bucket] += 1
    resultMatrix[position][bucket] += 1
  }

  const lossBucketCounts = [...stats.lossBucketCounts]
  if (result === 'lost' && losingValue !== null) {
    lossBucketCounts[bucketForValue(losingValue)] += 1
  }

  const scoreDistribution = [...stats.scoreDistribution]
  scoreDistribution[scoreBucketForCount(placements.length, total)] += 1

  const isWin = result === 'won'
  const currentWinStreak = isWin ? stats.currentWinStreak + 1 : 0

  return {
    totalGames: stats.totalGames + 1,
    totalWins: stats.totalWins + (isWin ? 1 : 0),
    totalTurns: stats.totalTurns + placements.length,
    winTurns: stats.winTurns + (isWin ? placements.length : 0),
    currentWinStreak,
    bestWinStreak: Math.max(stats.bestWinStreak, currentWinStreak),
    hardModeWins: stats.hardModeWins + (isWin && hardMode ? 1 : 0),
    scoreDistribution,
    matrix,
    winMatrix,
    lossMatrix,
    lossBucketCounts,
    lastGame: { placements, result, timestamp: Date.now() },
  }
}

export function winRate(stats: StatsData): number | null {
  if (stats.totalGames === 0) return null
  return Math.round((stats.totalWins / stats.totalGames) * 100)
}

export function averageTurns(stats: StatsData): number | null {
  if (stats.totalGames === 0) return null
  return stats.totalTurns / stats.totalGames
}

export function averageTurnsInWins(stats: StatsData): number | null {
  if (stats.totalWins === 0) return null
  return stats.winTurns / stats.totalWins
}

// Requires a handful of losses before naming a "most common" one — one or
// two losses in the same range is noise, not a pattern.
export function mostCommonLossBucket(stats: StatsData): number | null {
  const totalLosses = stats.totalGames - stats.totalWins
  if (totalLosses < MIN_LOSSES_FOR_LOSS_INSIGHT) return null

  let best = 0
  for (let i = 1; i < stats.lossBucketCounts.length; i++) {
    if (stats.lossBucketCounts[i] > stats.lossBucketCounts[best]) best = i
  }
  return stats.lossBucketCounts[best] > 0 ? best : null
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
  return `Numbers in the ${range} range usually land at ${usualLabel}, but this time ${insight.value} landed at ${actualLabel}.`
}
