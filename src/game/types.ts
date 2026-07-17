export const BOARD_SIZE = 20
export const MIN_VALUE = 1
export const MAX_VALUE = 1000

export type Position = number | null

export type GameStatus = 'idle' | 'rolled' | 'won' | 'lost'

export type ResultBadge = 'new-best' | 'tied-best' | null

export interface GameState {
  status: GameStatus
  positions: Position[]
  usedNumbers: number[]
  currentRoll: number | null
  validPositions: number[]
  placedCount: number
  lossReason: string | null
}

export function createInitialState(size: number = BOARD_SIZE): GameState {
  return {
    status: 'idle',
    positions: Array(size).fill(null),
    usedNumbers: [],
    currentRoll: null,
    validPositions: [],
    placedCount: 0,
    lossReason: null,
  }
}

export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GameState>
  return (
    typeof candidate.status === 'string' &&
    Array.isArray(candidate.positions) &&
    Array.isArray(candidate.usedNumbers) &&
    Array.isArray(candidate.validPositions) &&
    typeof candidate.placedCount === 'number'
  )
}
