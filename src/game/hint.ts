import { MAX_VALUE, MIN_VALUE, type Position } from './types'

// Where the suggested position comes from.
//
// It used to be crowd-sourced: whichever slot most people had put a number of
// this size on before. That can only ever reproduce the crowd's instinct, and
// the crowd's instinct is to judge a number against the whole board. Measured
// against this game's own engine, that instinct is worth about 9.4 slots of
// 20, which is almost exactly what the group actually averages.
//
// But where a number belongs is a question about the gap it lands in, not
// about the board as a whole. A 515 on an empty board belongs halfway down.
// A 515 that has to fit between an existing 480 and 520 belongs near the
// bottom of whatever room is left between them, however far up the board that
// happens to be. Reasoning that way is worth about 10.6 of 20 on the same
// measurement. That 1.2 slots is the entire skill gap, and hint.test.ts pins
// it down so a later simplification cannot quietly give it back.
//
// Worth being clear that this is still not a solved game. Following this
// every single turn fills the board about twice in forty thousand attempts,
// so the dot is a better guess rather than an answer, and taking it does not
// reduce the game to tapping where you are told.

export interface Gap {
  // The placed numbers either side of a run of empty slots. When nothing is
  // placed on that side yet, a sentinel sits just outside the legal range.
  lowerValue: number
  upperValue: number
  // The first and last empty slot in that run.
  firstSlot: number
  lastSlot: number
}

// The stretch of empty board a slot belongs to, and the two numbers hemming
// it in. Exported because it is the idea the hint is built on, and the guide
// describes it to players in these terms.
export function gapAround(positions: readonly Position[], slot: number): Gap {
  let lowerValue = MIN_VALUE - 1
  let firstSlot = 0
  for (let i = slot - 1; i >= 0; i--) {
    if (positions[i] !== null) {
      lowerValue = positions[i] as number
      firstSlot = i + 1
      break
    }
  }

  let upperValue = MAX_VALUE + 1
  let lastSlot = positions.length - 1
  for (let i = slot + 1; i < positions.length; i++) {
    if (positions[i] !== null) {
      upperValue = positions[i] as number
      lastSlot = i - 1
      break
    }
  }

  return { lowerValue, upperValue, firstSlot, lastSlot }
}

// A nudge among genuine choices, not a hint about legality: which positions
// are legal at all is already conveyed by which ones are lit.
//
// In practice every legal slot for a given roll sits in the same gap, since
// the placed numbers carve the value range into stretches that cannot
// overlap. This still works it out per slot rather than assuming that, which
// costs nothing on a board of thirty and cannot be wrong.
export function suggestedPosition(
  positions: readonly Position[],
  value: number,
  validPositions: readonly number[],
): number | null {
  // Nothing to advise when there is no choice to make.
  if (validPositions.length <= 1) return null

  let best = validPositions[0]
  let bestDistance = Infinity

  for (const slot of validPositions) {
    const { lowerValue, upperValue, firstSlot, lastSlot } = gapAround(positions, slot)

    // How far along this number sits between its two neighbours, mapped onto
    // the empty slots that lie between them.
    const share = (value - lowerValue) / (upperValue - lowerValue)
    const ideal = firstSlot + (lastSlot - firstSlot) * share

    const distance = Math.abs(slot - ideal)
    if (distance < bestDistance) {
      bestDistance = distance
      best = slot
    }
  }

  return best
}
