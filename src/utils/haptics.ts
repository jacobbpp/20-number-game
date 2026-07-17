export type HapticPattern = 'place' | 'win' | 'lose' | 'copy'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  place: 15,
  win: [20, 40, 20, 40, 60],
  lose: [80, 40, 80],
  copy: 12,
}

export function vibrate(pattern: HapticPattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(PATTERNS[pattern])
}
