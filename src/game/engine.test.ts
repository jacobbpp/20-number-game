import { describe, expect, it } from 'vitest'
import { computeValidPositions, place, roll, rollNumber } from './engine'
import { BOARD_SIZE, createInitialState } from './types'

describe('computeValidPositions', () => {
  it('allows any position on an empty board', () => {
    const positions = Array(BOARD_SIZE).fill(null)
    const valid = computeValidPositions(positions, 500)
    expect(valid).toHaveLength(BOARD_SIZE)
  })

  it('only allows positions strictly between neighboring occupied values', () => {
    const positions: (number | null)[] = Array(BOARD_SIZE).fill(null)
    positions[0] = 64
    positions[1] = 75
    // 63 is lower than 64, and position 0 is already occupied, so there is
    // no empty position before it that could legally hold 63.
    const valid = computeValidPositions(positions, 63)
    expect(valid).toEqual([])
  })

  it('finds the gap between two occupied values', () => {
    const positions: (number | null)[] = Array(BOARD_SIZE).fill(null)
    positions[8] = 467
    positions[13] = 612
    const valid = computeValidPositions(positions, 550)
    expect(valid).toEqual([9, 10, 11, 12])
  })
})

describe('rollNumber', () => {
  it('never returns a number already used', () => {
    const used = [10, 20, 30]
    let calls = 0
    const rng = () => {
      // The first three draws collide with used numbers (9->10, 19->20, 29->30);
      // the fourth draw must be taken instead.
      const sequence = [0.009, 0.019, 0.029, 0.5]
      const value = sequence[calls] ?? 0.5
      calls++
      return value
    }
    const result = rollNumber(used, rng)
    expect(used).not.toContain(result)
    expect(calls).toBe(4)
  })
})

describe('roll', () => {
  it('ends the game immediately when no position can hold the roll', () => {
    let state = createInitialState()
    state.positions[0] = 64
    state.positions[1] = 75
    // Force a roll of 63: below 64, with position 0 already occupied.
    state = roll(state, () => 62 / 1000)
    expect(state.currentRoll).toBe(63)
    expect(state.status).toBe('lost')
    expect(state.lossReason).toMatch(/63/)
  })
})

describe('place', () => {
  it('places a rolled number into a valid position and returns to idle', () => {
    let state = createInitialState()
    state = roll(state, () => 0.5) // rolls 501
    const target = state.validPositions[0]
    state = place(state, target)
    expect(state.positions[target]).toBe(501)
    expect(state.status).toBe('idle')
    expect(state.placedCount).toBe(1)
  })

  it('rejects placement into a position outside the valid set', () => {
    let state = createInitialState()
    state.positions[5] = 300
    state = roll(state, () => 0.5) // rolls 501, only valid at positions 6..19
    expect(state.validPositions).not.toContain(0)
    const attempted = place(state, 0)
    expect(attempted).toBe(state)
    expect(attempted.positions[0]).toBeNull()
  })

  it('wins when the final position is filled legally', () => {
    let state = createInitialState()
    // Fill 19 of 20 positions with an evenly spaced ascending sequence,
    // leaving position 10 open for the winning roll.
    const values = Array.from({ length: BOARD_SIZE }, (_, i) => (i + 1) * 40)
    values.forEach((value, i) => {
      if (i === 10) return
      state.positions[i] = value
    })
    state.placedCount = BOARD_SIZE - 1
    state.usedNumbers = values.filter((_, i) => i !== 10)

    const winningValue = values[10]
    state = roll(state, () => (winningValue - 1) / 1000)
    expect(state.validPositions).toEqual([10])
    state = place(state, 10)
    expect(state.status).toBe('won')
    expect(state.placedCount).toBe(BOARD_SIZE)
    expect(state.positions.every(p => p !== null)).toBe(true)
  })

  it('wins at the size of a smaller board, not the fixed BOARD_SIZE constant', () => {
    let state = createInitialState(5)
    expect(state.positions).toHaveLength(5)

    // Ascending values placed left-to-right at the lowest open valid
    // position each time always stays legal, filling the board in order.
    const values = [100, 200, 300, 400, 500]
    for (const value of values) {
      state = roll(state, () => (value - 1) / 1000)
      state = place(state, state.validPositions[0])
    }

    expect(state.status).toBe('won')
    expect(state.placedCount).toBe(5)
    expect(state.positions).toEqual(values)
  })
})
