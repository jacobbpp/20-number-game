import { describe, expect, it } from 'vitest'
import { gapAround, suggestedPosition } from './hint'
import { place, roll } from './engine'
import { MAX_VALUE, MIN_VALUE, createInitialState, type Position } from './types'

const SIZE = 20

function emptyBoard(size = SIZE): Position[] {
  return Array(size).fill(null)
}

// Builds a board from a sparse map of slot to value, so a test reads as the
// board it is describing rather than as twenty nulls with two edits.
function board(placed: Record<number, number>, size = SIZE): Position[] {
  const positions = emptyBoard(size)
  for (const [slot, value] of Object.entries(placed)) positions[Number(slot)] = value
  return positions
}

// Every empty slot a value could legally take, worked out independently of
// the engine so a test is not asserting against the thing it is testing.
function legalSlots(positions: Position[], value: number): number[] {
  return positions
    .map((_, slot) => slot)
    .filter(slot => {
      if (positions[slot] !== null) return false
      const { lowerValue, upperValue } = gapAround(positions, slot)
      return value > lowerValue && value < upperValue
    })
}

describe('the gap a slot sits in', () => {
  it('spans the whole board when nothing is placed', () => {
    expect(gapAround(emptyBoard(), 7)).toEqual({
      lowerValue: MIN_VALUE - 1,
      upperValue: MAX_VALUE + 1,
      firstSlot: 0,
      lastSlot: SIZE - 1,
    })
  })

  it('is bounded by the nearest placed number on each side', () => {
    expect(gapAround(board({ 2: 480, 17: 520 }), 9)).toEqual({
      lowerValue: 480,
      upperValue: 520,
      firstSlot: 3,
      lastSlot: 16,
    })
  })

  it('uses a sentinel on whichever side has nothing placed yet', () => {
    const positions = board({ 5: 300 })

    expect(gapAround(positions, 1)).toMatchObject({ lowerValue: MIN_VALUE - 1, upperValue: 300, lastSlot: 4 })
    expect(gapAround(positions, 9)).toMatchObject({ lowerValue: 300, upperValue: MAX_VALUE + 1, firstSlot: 6 })
  })
})

describe('the suggestion on an open board', () => {
  it('puts a middling number in the middle', () => {
    const positions = emptyBoard()
    const suggestion = suggestedPosition(positions, 500, legalSlots(positions, 500))

    expect(suggestion).toBeGreaterThanOrEqual(9)
    expect(suggestion).toBeLessThanOrEqual(10)
  })

  it('puts a low number near the top and a high one near the bottom', () => {
    const positions = emptyBoard()

    expect(suggestedPosition(positions, 40, legalSlots(positions, 40))).toBeLessThanOrEqual(1)
    expect(suggestedPosition(positions, 970, legalSlots(positions, 970))).toBeGreaterThanOrEqual(18)
  })
})

describe('the suggestion inside a tight gap', () => {
  // The whole point of the change. 515 is roughly halfway along 1 to 1000, so
  // judging it against the board says "about slot 10". But it has to fit
  // between an existing 480 and 520, and within that pair it sits near the
  // top end, so it belongs near the bottom of the room that is left.
  it('places by where the number falls between its neighbours, not on the board', () => {
    const positions = board({ 2: 480, 17: 520 })
    const value = 515

    const suggestion = suggestedPosition(positions, value, legalSlots(positions, value))

    expect(suggestion).toBe(14)
    // What the old crowd-driven hint would converge on, for contrast.
    const boardWideGuess = Math.round(((value - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * (SIZE - 1))
    expect(boardWideGuess).toBe(10)
  })

  it('mirrors that for a number low in the same gap', () => {
    const positions = board({ 2: 480, 17: 520 })

    expect(suggestedPosition(positions, 484, legalSlots(positions, 484))).toBe(4)
  })

  it('keeps room on both sides for a number in the middle of its gap', () => {
    // 500 is exactly halfway between 480 and 520, which lands halfway between
    // slots 9 and 10. Neither is more correct, and the lower one wins so the
    // dot is at least in the same place every time the same board comes up.
    const positions = board({ 2: 480, 17: 520 })

    expect(suggestedPosition(positions, 500, legalSlots(positions, 500))).toBe(9)
  })
})

describe('when there is nothing to advise', () => {
  it('says nothing when only one position is legal', () => {
    expect(suggestedPosition(emptyBoard(), 500, [7])).toBeNull()
  })

  it('says nothing when no position is legal', () => {
    expect(suggestedPosition(emptyBoard(), 500, [])).toBeNull()
  })

  it('never suggests a position that was not offered', () => {
    const positions = board({ 2: 480, 17: 520 })
    const offered = [5, 6]

    expect(offered).toContain(suggestedPosition(positions, 515, offered))
  })
})

// A deterministic rng, so the measurement below is a fixed number rather than
// something that drifts between runs.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The instinct the old hint could only ever learn: judge the number against
// the whole board and take the nearest legal slot to that.
function boardWideChoice(value: number, valid: readonly number[], size: number): number {
  const target = ((value - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * (size - 1)
  return valid.reduce((best, slot) => (Math.abs(slot - target) < Math.abs(best - target) ? slot : best), valid[0])
}

function meanPlaced(games: number, choose: (state: ReturnType<typeof createInitialState>) => number): number {
  const rng = seededRandom(20260810)
  let total = 0

  for (let game = 0; game < games; game++) {
    let state = createInitialState(SIZE)
    while (true) {
      state = roll(state, rng)
      if (state.status === 'lost') break
      state = place(state, choose(state))
      if (state.status === 'won') break
    }
    total += state.placedCount
  }

  return total / games
}

describe('what the suggestion is actually worth', () => {
  const GAMES = 2000

  it('beats judging the number against the whole board, by about a slot', () => {
    // This is the finding the change exists for, so it is measured rather
    // than asserted by eye. The margin is deliberately well under the
    // observed gap of roughly 1.2 slots, to test the improvement rather than
    // the exact arithmetic of one rng stream.
    const boardWide = meanPlaced(GAMES, s => boardWideChoice(s.currentRoll as number, s.validPositions, SIZE))
    const gapAware = meanPlaced(GAMES, s => suggestedPosition(s.positions, s.currentRoll as number, s.validPositions) ?? s.validPositions[0])

    expect(gapAware).toBeGreaterThan(boardWide + 0.5)
  })

  it('still loses about half the board, so the hint is a guess and not an answer', () => {
    // If following the hint ever started filling boards, the game would have
    // become tapping a dot and this would be the thing that noticed.
    const gapAware = meanPlaced(GAMES, s => suggestedPosition(s.positions, s.currentRoll as number, s.validPositions) ?? s.validPositions[0])

    expect(gapAware).toBeGreaterThan(9)
    expect(gapAware).toBeLessThan(13)
  })
})
