export type RGB = [number, number, number]

export function lerpColor(from: RGB, to: RGB, t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t)
  const g = Math.round(from[1] + (to[1] - from[1]) * t)
  const b = Math.round(from[2] + (to[2] - from[2]) * t)
  return `rgb(${r} ${g} ${b})`
}
