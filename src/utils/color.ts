export type RGB = [number, number, number]

export function lerpColor(from: RGB, to: RGB, t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t)
  const g = Math.round(from[1] + (to[1] - from[1]) * t)
  const b = Math.round(from[2] + (to[2] - from[2]) * t)
  return `rgb(${r} ${g} ${b})`
}

const SEQUENCE_VIOLET: RGB = [111, 95, 142] // #6F5F8E — tb-dev accent
const SEQUENCE_ORANGE: RGB = [207, 143, 95] // #CF8F5F — tb-dev cta

// Violet -> orange, the same low-to-high sequence used for the board's
// position-index chips. Built only from the brand's two accent hues, so
// it stays on-brand while still giving a scannable low-to-high cue. t is
// a 0-1 fraction of the way through the sequence (e.g. position index /
// (size - 1)).
export function sequenceColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  return lerpColor(SEQUENCE_VIOLET, SEQUENCE_ORANGE, clamped)
}
