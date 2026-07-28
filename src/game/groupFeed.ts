// Two of the devices in the community have never saved a name, since a name
// is only ever chosen on a qualifying leaderboard score. They still played,
// so their games belong in the feed — they just can't be labelled.
export const ANONYMOUS_PLAYER = 'someone'

export function displayName(name: string | null): string {
  return name !== null && name.trim().length > 0 ? name.trim() : ANONYMOUS_PLAYER
}

// Deliberately coarse. This is a glanceable feed, so "12m" carries everything
// a reader needs and avoids implying a precision the timestamps don't have.
export function formatRelativeTime(at: string, nowMs: number): string {
  const then = Date.parse(at)
  if (Number.isNaN(then)) return ''

  // Clamped at zero: a device clock running slightly ahead of the server's
  // would otherwise produce a negative age and read as "in 3 minutes".
  const minutes = Math.floor(Math.max(0, nowMs - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

export function describeMode(mode: string): string {
  return mode === 'daily' ? 'daily' : 'free play'
}
