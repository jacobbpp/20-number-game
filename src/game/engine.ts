import { BOARD_SIZE, MAX_VALUE, MIN_VALUE, type GameState, createInitialState } from './types'

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

export function rollNumber(usedNumbers: number[], rng: () => number = Math.random): number {
  if (usedNumbers.length >= MAX_VALUE - MIN_VALUE + 1) {
    throw new Error('No numbers remain to roll')
  }
  const used = new Set(usedNumbers)
  let candidate: number
  do {
    candidate = Math.floor(rng() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE
  } while (used.has(candidate))
  return candidate
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

  if (placedCount === BOARD_SIZE) {
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

export function restart(): GameState {
  return createInitialState()
}
