import { MAX_VALUE, MIN_VALUE, type GameState } from './types'

export function computeValidPositions(positions: (number | null)[], value: number): number[] {
  const valid: number[] = []

  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== null) continue

    let lowerBound = -Infinity
    for (let j = i - 1; j >= 0; j--) {
      if (positions[j] !== null) {
        lowerBound = positions[j] as number
        break
      }
    }

    let upperBound = Infinity
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j] !== null) {
        upperBound = positions[j] as number
        break
      }
    }

    if (value > lowerBound && value < upperBound) {
      valid.push(i)
    }
  }

  return valid
}

const ROLL_RANGE = MAX_VALUE - MIN_VALUE + 1
// Generous headroom over the worst real case (999 of 1000 numbers used,
// where expected retries stay low) so a broken rng — not real gameplay —
// is what this bound is actually there to catch.
const MAX_ROLL_ATTEMPTS = ROLL_RANGE * 10

export function rollNumber(usedNumbers: number[], rng: () => number = Math.random): number {
  if (usedNumbers.length >= ROLL_RANGE) {
    throw new Error('No numbers remain to roll')
  }
  const used = new Set(usedNumbers)
  for (let attempt = 0; attempt < MAX_ROLL_ATTEMPTS; attempt++) {
    const candidate = Math.floor(rng() * ROLL_RANGE) + MIN_VALUE
    if (!used.has(candidate)) return candidate
  }
  throw new Error('rollNumber exceeded its retry limit — rng may be malfunctioning')
}

export function roll(state: GameState, rng?: () => number): GameState {
  if (state.status !== 'idle') return state

  const nextNumber = rollNumber(state.usedNumbers, rng)
  const usedNumbers = [...state.usedNumbers, nextNumber]
  const validPositions = computeValidPositions(state.positions, nextNumber)

  if (validPositions.length === 0) {
    return {
      ...state,
      status: 'lost',
      usedNumbers,
      currentRoll: nextNumber,
      validPositions: [],
      lossReason: `${nextNumber} cannot legally be placed in any remaining position.`,
    }
  }

  return {
    ...state,
    status: 'rolled',
    usedNumbers,
    currentRoll: nextNumber,
    validPositions,
  }
}

export function place(state: GameState, position: number): GameState {
  if (state.status !== 'rolled' || state.currentRoll === null) return state
  if (!state.validPositions.includes(position)) return state

  const positions = [...state.positions]
  positions[position] = state.currentRoll
  const placedCount = state.placedCount + 1

  if (placedCount === state.positions.length) {
    return {
      ...state,
      status: 'won',
      positions,
      placedCount,
      currentRoll: null,
      validPositions: [],
    }
  }

  return {
    ...state,
    status: 'idle',
    positions,
    placedCount,
    currentRoll: null,
    validPositions: [],
  }
}
