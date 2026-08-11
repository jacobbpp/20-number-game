import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_ALPHABET,
  CHALLENGE_BOARD_SIZE,
  createChallengeRng,
  describeOutcome,
  isChallengeCode,
  isSettled,
  mintChallengeCode,
  normaliseCode,
  outcomeOf,
  type ChallengeRecord,
} from './challenge'
import { createDailyRng } from './daily'
import { place, roll } from './engine'
import { createInitialState } from './types'

function record(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    code: 'K7M2QP',
    boardSize: CHALLENGE_BOARD_SIZE,
    challengerName: 'JRC',
    challengerScore: 14,
    invitedName: null,
    opponentName: null,
    opponentScore: null,
    ...overrides,
  }
}

// Plays a whole board from one code, always choosing the first legal slot, so
// the run is a pure function of the rolls it was given.
function playFrom(code: string): number[] {
  const rng = createChallengeRng(code)
  let state = createInitialState(CHALLENGE_BOARD_SIZE)
  const rolls: number[] = []

  while (true) {
    state = roll(state, rng)
    rolls.push(state.currentRoll as number)
    if (state.status === 'lost') return rolls
    state = place(state, state.validPositions[0])
    if (state.status === 'won') return rolls
  }
}

describe('the shared board', () => {
  it('deals the same rolls to everyone holding the code', () => {
    // The whole point. Neither phone ever sends the other a board.
    expect(playFrom('K7M2QP')).toEqual(playFrom('K7M2QP'))
  })

  it('deals a different board for a different code', () => {
    expect(playFrom('K7M2QP')).not.toEqual(playFrom('B4XN9T'))
  })

  it('carries on the same sequence after a refresh mid-game', () => {
    // The generator cannot be saved to storage, so a reload rebuilds it from
    // the start of the sequence. rollNumber skips anything already used, so
    // replaying the opening rolls lands on the next unused one. Without that
    // a reload would quietly hand somebody a different board from their
    // opponent, which is the one thing this must never do.
    const code = 'K7M2QP'
    const uninterrupted = playFrom(code)

    const interrupted: number[] = []
    let rng = createChallengeRng(code)
    let state = createInitialState(CHALLENGE_BOARD_SIZE)

    for (let move = 0; ; move++) {
      state = roll(state, rng)
      interrupted.push(state.currentRoll as number)
      if (state.status === 'lost') break
      state = place(state, state.validPositions[0])
      if (state.status === 'won') break
      // Reload after the third placement: a brand new generator, and only the
      // saved game state to resync from.
      if (move === 2) rng = createChallengeRng(code)
    }

    expect(interrupted).toEqual(uninterrupted)
  })

  it('cannot collide with a daily board that reads the same', () => {
    // Both hash a string. Without a prefix, a code and a date made of the
    // same characters would produce the same game.
    const asChallenge = createChallengeRng('2026-08-11')
    const asDaily = createDailyRng('2026-08-11')

    expect(asChallenge()).not.toBe(asDaily())
  })
})

describe('the code', () => {
  it('is six characters a person can read aloud', () => {
    for (let i = 0; i < 40; i++) {
      const code = mintChallengeCode()
      expect(code).toHaveLength(6)
      expect(isChallengeCode(code)).toBe(true)
    }
  })

  it('leaves out every character people confuse', () => {
    for (const confusable of ['0', 'O', '1', 'I', 'L']) {
      expect(CHALLENGE_ALPHABET).not.toContain(confusable)
    }
  })

  it('does not hand out the same code twice in a row', () => {
    const codes = new Set(Array.from({ length: 50 }, () => mintChallengeCode()))

    expect(codes.size).toBe(50)
  })

  it('accepts a code typed the way somebody would actually type it', () => {
    expect(normaliseCode('  k7m2qp  ')).toBe('K7M2QP')
    expect(isChallengeCode(normaliseCode(' k7m2qp '))).toBe(true)
  })

  it('rejects anything that is not one', () => {
    expect(isChallengeCode('ABC')).toBe(false)
    expect(isChallengeCode('ABCDEFG')).toBe(false)
    expect(isChallengeCode('ABC0DE')).toBe(false)
    expect(isChallengeCode('ABC-DE')).toBe(false)
  })
})

describe('who won', () => {
  it('calls it three ways', () => {
    expect(outcomeOf(16, 14)).toBe('won')
    expect(outcomeOf(14, 16)).toBe('lost')
    expect(outcomeOf(14, 14)).toBe('level')
  })

  it('says how far apart on the same rolls', () => {
    expect(describeOutcome('won', 16, 14, 20)).toBe('The same 20 rolls. You placed 2 places more.')
    expect(describeOutcome('lost', 12, 15, 20)).toBe('The same 20 rolls. They placed 3 places more.')
  })

  it('counts a single place properly', () => {
    expect(describeOutcome('won', 15, 14, 20)).toContain('1 place more')
  })

  it('says level without inventing a gap', () => {
    expect(describeOutcome('level', 14, 14, 20)).toBe('The same 20 rolls, and you both placed 14.')
  })
})

describe('whether it is finished', () => {
  it('is not settled while one side is still to play', () => {
    expect(isSettled(record())).toBe(false)
  })

  it('is settled once both scores are in', () => {
    expect(isSettled(record({ opponentName: 'SJW', opponentScore: 16 }))).toBe(true)
  })

  it('is not settled when the challengers score is being withheld', () => {
    // What the opponent sees before they have played.
    expect(isSettled(record({ challengerScore: null }))).toBe(false)
  })
})
