export type RGB = [number, number, number]

export function lerpColor(from: RGB, to: RGB, t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t)
  const g = Math.round(from[1] + (to[1] - from[1]) * t)
  const b = Math.round(from[2] + (to[2] - from[2]) * t)
  return `rgb(${r} ${g} ${b})`
}

const SEQUENCE_CORAL: RGB = [240, 153, 123] // #F0997B
const SEQUENCE_PURPLE: RGB = [107, 90, 158] // #6B5A9E
const SEQUENCE_AMBER: RGB = [239, 159, 39] // #EF9F27

// Coral -> purple -> amber, the same low-to-high sequence used for the
// board's position-index chips. t is a 0-1 fraction of the way through
// the sequence (e.g. position index / (size - 1)).
export function sequenceColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped <= 0.5
    ? lerpColor(SEQUENCE_CORAL, SEQUENCE_PURPLE, clamped / 0.5)
    : lerpColor(SEQUENCE_PURPLE, SEQUENCE_AMBER, (clamped - 0.5) / 0.5)
}
