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
    hardModeGames: stats.hardModeGames + (hardMode ? 1 : 0),
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

const MIN_BUCKET_SIGNAL = 3
const MIN_GAMES_FOR_SIGNATURE = 5
const MIN_HARD_MODE_GAMES = 3

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

// The position filled most often across every completed game — not
// necessarily meaningful on its own, just a "here's your habit" fact.
// Requires a handful of games so one early run doesn't dominate.
export function signaturePosition(stats: StatsData): { position: number; count: number } | null {
  if (stats.totalGames < MIN_GAMES_FOR_SIGNATURE) return null

  let best = 0
  let bestCount = 0
  for (let position = 0; position < stats.matrix.length; position++) {
    const count = stats.matrix[position].reduce((sum, c) => sum + c, 0)
    if (count > bestCount) {
      bestCount = count
      best = position
    }
  }
  return bestCount > 0 ? { position: best, count: bestCount } : null
}

// Win rate restricted to games played with hard mode on — needs its own
// threshold since it's a smaller sample than overall win rate.
export function hardModeWinRate(stats: StatsData): number | null {
  if (stats.hardModeGames < MIN_HARD_MODE_GAMES) return null
  return Math.round((stats.hardModeWins / stats.hardModeGames) * 100)
}

// Among the positions currently legal for this roll, which one similar-value
// numbers have most often landed on in the given matrix, a nudge among
// genuine choices, not a hint about legality itself (that's already conveyed
// by which positions are highlighted at all). The matrix is caller-supplied
// so this works the same whether it's personal or community history. Only
// meaningful when there's an actual choice to make and enough signal behind
// the pick.
export function suggestedPosition(matrix: number[][], value: number, validPositions: number[]): number | null {
  if (validPositions.length <= 1) return null

  const bucket = bucketForValue(value)
  const candidates = validPositions
    .map(position => ({ position, count: matrix[position][bucket] }))
    .filter(c => c.count >= MIN_SIGNAL)

  if (candidates.length === 0) return null

  return candidates.reduce((a, b) => (b.count > a.count ? b : a)).position
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

export interface PositionWinRateStat {
  position: number
  winRatePercent: number
}

// Mirrors bestValueRange, but sliced by board position instead of value
// range — for each position with enough placements behind it, what
// fraction of those placements happened in games that were ultimately won.
export function bestPositionInsight(stats: StatsData): PositionWinRateStat | null {
  const rates: { position: number; winRate: number; total: number }[] = []
  for (let position = 0; position < stats.winMatrix.length; position++) {
    const wins = stats.winMatrix[position].reduce((sum, c) => sum + c, 0)
    const losses = stats.lossMatrix[position].reduce((sum, c) => sum + c, 0)
    const total = wins + losses
    if (total >= MIN_BUCKET_SIGNAL) rates.push({ position, winRate: wins / total, total })
  }
  if (rates.length === 0) return null
  const best = rates.reduce((a, b) => (b.winRate > a.winRate ? b : a))
  return { position: best.position, winRatePercent: Math.round(best.winRate * 100) }
}

const MIN_HALF_SIGNAL = 5

export interface BoardHalfStat {
  strongerHalf: 'top' | 'bottom'
  strongerWinRatePercent: number
  weakerWinRatePercent: number
}

// Splits the board into its top and bottom halves (positions 0-9 vs
// 10-19 on the fixed 20-slot free-play board) and compares win rate
// between them — a coarse structural read rather than a specific range
// or position, using the same win/loss matrices as every other insight.
export function boardHalfComparison(stats: StatsData): BoardHalfStat | null {
  const midpoint = Math.floor(stats.winMatrix.length / 2)
  const halfRate = (from: number, to: number) => {
    let wins = 0
    let losses = 0
    for (let position = from; position < to; position++) {
      wins += stats.winMatrix[position].reduce((sum, c) => sum + c, 0)
      losses += stats.lossMatrix[position].reduce((sum, c) => sum + c, 0)
    }
    const total = wins + losses
    return total >= MIN_HALF_SIGNAL ? wins / total : null
  }

  const topRate = halfRate(0, midpoint)
  const bottomRate = halfRate(midpoint, stats.winMatrix.length)
  if (topRate === null || bottomRate === null || topRate === bottomRate) return null

  const strongerHalf = topRate > bottomRate ? 'top' : 'bottom'
  const strongerRate = Math.max(topRate, bottomRate)
  const weakerRate = Math.min(topRate, bottomRate)
  return {
    strongerHalf,
    strongerWinRatePercent: Math.round(strongerRate * 100),
    weakerWinRatePercent: Math.round(weakerRate * 100),
  }
}

export interface StreakMomentum {
  kind: 'record' | 'chasing'
  winsToTie: number
}

// Reframes the win-streak numbers already shown elsewhere as forward-looking
// context rather than a flat readout. Only meaningful while a streak is
// actually active — a broken streak has nothing to chase.
export function streakMomentum(stats: StatsData): StreakMomentum | null {
  if (stats.currentWinStreak === 0) return null
  if (stats.currentWinStreak >= stats.bestWinStreak) return { kind: 'record', winsToTie: 0 }
  return { kind: 'chasing', winsToTie: stats.bestWinStreak - stats.currentWinStreak }
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
