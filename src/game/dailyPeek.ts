import { createDailyRng } from './daily'
import { computeValidPositions, rollNumber } from './engine'
import { MAX_VALUE, MIN_VALUE } from './types'

const ROLL_RANGE = MAX_VALUE - MIN_VALUE + 1
const DEFAULT_PEEK_COUNT = 3

export interface DailyPeekEntry {
  value: number
  validPositions: number[]
}

// Only meaningful for the daily challenge: its rolls come from a seeded rng
// keyed off the date, the same sequence for everyone, so "what would have
// come next" has a real answer. Free play's rolls are genuine Math.random()
// with no fixed sequence to replay, so there's nothing honest to peek at.
//
// Replays the actual roll history on a fresh instance of that same seeded
// rng to reach the exact point the real game ended at, then draws a few
// more hypothetical rolls from there. Read-only: never touches the live
// game's own rng. The board (finalPositions) stays frozen exactly as the
// game actually ended for every peeked entry — this shows whether each
// hypothetical roll could have landed on the real board, not a simulated
// continuation where earlier peeks get placed before later ones are drawn.
export function peekNextRolls(
  dateString: string,
  actualUsedNumbers: number[],
  finalPositions: (number | null)[],
  count: number = DEFAULT_PEEK_COUNT,
): DailyPeekEntry[] {
  const rng = createDailyRng(dateString)
  const used: number[] = []

  // rollNumber's retry loop can consume more than one rng() call per
  // historical roll whenever it hits a duplicate, so simply re-seeding and
  // counting rolls isn't enough to land the fresh rng at the same internal
  // position the real game reached — replaying through rollNumber itself
  // reproduces those retries exactly.
  for (const value of actualUsedNumbers) {
    rollNumber(used, rng)
    used.push(value)
  }

  const peeks: DailyPeekEntry[] = []
  for (let i = 0; i < count && used.length < ROLL_RANGE; i++) {
    const value = rollNumber(used, rng)
    used.push(value)
    peeks.push({ value, validPositions: computeValidPositions(finalPositions, value) })
  }
  return peeks
}
