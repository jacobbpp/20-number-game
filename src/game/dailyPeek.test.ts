import { describe, expect, it } from 'vitest'
import { createDailyRng } from './daily'
import { peekNextRolls } from './dailyPeek'
import { computeValidPositions, place, roll, rollNumber } from './engine'
import { createInitialState, type GameState } from './types'

const DATE = '2026-07-19'

describe('peekNextRolls', () => {
  it('matches exactly what the real seeded rng rolls next, continuing from where a real game left off', () => {
    // Play a real game partway through on the actual seeded rng, always
    // placing at the first legal position, same as simulateDailyGame in
    // App.daily.test.tsx.
    const rng = createDailyRng(DATE)
    let state: GameState = roll(createInitialState(20), rng)
    for (let i = 0; i < 5 && state.status === 'rolled'; i++) {
      state = place(state, state.validPositions[0])
      if (state.status === 'idle') state = roll(state, rng)
    }

    const peeks = peekNextRolls(DATE, state.usedNumbers, state.positions, 3)

    // Continue the SAME live rng three more times — ground truth for what
    // "next" actually means on this exact deterministic sequence.
    const expectedValues: number[] = []
    const usedSoFar = [...state.usedNumbers]
    for (let i = 0; i < 3; i++) {
      const value = rollNumber(usedSoFar, rng)
      usedSoFar.push(value)
      expectedValues.push(value)
    }

    expect(peeks.map(p => p.value)).toEqual(expectedValues)
  })

  it('evaluates each peeked value against the frozen final board, not a simulated continuation', () => {
    const positions = Array(20).fill(null)
    positions[0] = 100
    positions[1] = 900

    const peeks = peekNextRolls(DATE, [100, 900], positions, 5)

    for (const peek of peeks) {
      expect(peek.validPositions).toEqual(computeValidPositions(positions, peek.value))
    }
  })

  it('is deterministic: the same inputs always produce the same peek', () => {
    const positions = Array(10).fill(null)
    positions[0] = 500

    const first = peekNextRolls(DATE, [500], positions, 4)
    const second = peekNextRolls(DATE, [500], positions, 4)

    expect(first).toEqual(second)
  })

  it('returns a different sequence for a different date', () => {
    const positions = Array(10).fill(null)
    positions[0] = 500

    const today = peekNextRolls('2026-07-19', [500], positions, 4)
    const otherDay = peekNextRolls('2026-07-20', [500], positions, 4)

    expect(today.map(p => p.value)).not.toEqual(otherDay.map(p => p.value))
  })
})
