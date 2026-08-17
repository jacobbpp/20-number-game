import { BOARD_SIZE } from './types'

export const VALUE_BUCKETS = 10
export const BUCKET_SIZE = 1000 / VALUE_BUCKETS
export const SCORE_BUCKETS = 4
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
  hardModeGames: number // games (won or lost) recorded while hard mode was on
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
    hardModeGames: 0,
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
    hardModeGames: stats.hardModeGames + (hardMode ? 1 : 0),
    scoreDistribution,
    matrix,
    winMatrix,
    lossMatrix,
    lossBucketCounts,
    lastGame: { placements, result, timestamp: Date.now() },
  }
}

// Whether anything win-shaped is worth putting on screen.
//
// Filling a twenty slot board turns up about once in twenty thousand attempts
// and has never once happened across every game this app has logged. So every
// number derived from wins sits at zero permanently, and a permanent zero is
// not a statistic: it is a running tally of failure that can never move. The
// win itself stays in the game as the thing nobody has done. The arithmetic
// about it does not need to be on display until there is some.
//
// Order 6 deliberately does not feed these (game/shortBoard.ts explains why),
// so finding the short board does not switch them back on.
export function hasWins(stats: StatsData): boolean {
  return stats.totalWins > 0
}

export function averageTurns(stats: StatsData): number | null {
  if (stats.totalGames === 0) return null
  return stats.totalTurns / stats.totalGames
}

export function averageTurnsInWins(stats: StatsData): number | null {
  if (stats.totalWins === 0) return null
  return stats.winTurns / stats.totalWins
}

const MIN_BUCKET_SIGNAL = 3

export interface ValueRangeStat {
  bucket: number
  winRatePercent: number
}

export interface ValueRangeBarStat {
  bucket: number
  winRate: number // 0 when hasSignal is false — the bar has nothing to show, not a real 0%
  total: number
  hasSignal: boolean
}

// Every value range's win-rate correlation, signal or not — a bar chart
// needs all ten slots to stay in place even when some don't have enough
// data yet, unlike the best/worst picks below which only ever consider
// ranges that cleared the signal threshold.
export function allValueRangeStats(stats: StatsData): ValueRangeBarStat[] {
  const result: ValueRangeBarStat[] = []
  for (let bucket = 0; bucket < VALUE_BUCKETS; bucket++) {
    let wins = 0
    let losses = 0
    for (let position = 0; position < stats.winMatrix.length; position++) {
      wins += stats.winMatrix[position][bucket]
      losses += stats.lossMatrix[position][bucket]
    }
    const total = wins + losses
    result.push({ bucket, winRate: total > 0 ? wins / total : 0, total, hasSignal: total >= MIN_BUCKET_SIGNAL })
  }
  return result
}

// For each value range with enough placements behind it, what fraction of
// those placements happened in games that were ultimately won — a
// correlation, not a causal claim, same character as the existing
// most-common-loss-range insight.
function bucketWinRates(stats: StatsData): { bucket: number; winRate: number; total: number }[] {
  return allValueRangeStats(stats).filter(stat => stat.hasSignal)
}

export function bestValueRange(stats: StatsData): ValueRangeStat | null {
  const rates = bucketWinRates(stats)
  if (rates.length === 0) return null
  const best = rates.reduce((a, b) => (b.winRate > a.winRate ? b : a))
  return { bucket: best.bucket, winRatePercent: Math.round(best.winRate * 100) }
}

// The in-game suggestion used to live here, picking whichever position
// similar-value numbers had most often landed on in the community matrix. It
// now lives in game/hint.ts and is worked out from the board instead, because
// a crowd average can only ever reproduce the crowd's instinct. That file
// explains the reasoning and measures the difference.

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
