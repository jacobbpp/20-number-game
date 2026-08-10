// What a move actually carries. This is an explicit allowlist rather than
// "everything under order20-", because the two failure modes are not equally
// bad: a new key that quietly fails to travel loses one stat until someone
// notices, whereas a new key that quietly does travel could carry this
// device's identity onto another device and have two of them writing streaks
// as the same player. Adding a key here is a deliberate act.
export const TRANSFERRED_KEYS = [
  // The game itself.
  'order20-stats',
  'order20-best-score',
  'order20-best-run',
  'order20-achievements-unlocked',
  'order20-daily-activity',
  'order20-daily-history',
  'order20-daily-result',
  'order20-daily-streak',
  'order20-leaderboard-name',
  // Preferences, so the new device feels like the old one rather than factory
  // fresh. Onboarding and What's New come too: an existing player has already
  // seen both and should not be shown them again on a device they just moved to.
  'order20-hard-mode',
  'order20-sound-muted',
  'order20-theme',
  'order20-show-home-screen',
  'order20-onboarded',
  'order20-whatsnew-seen-version',
] as const

// Deliberately left behind.
export const DEVICE_LOCAL_KEYS = [
  // The receiving device keeps its own. Sharing one id would put two devices
  // on the streak leaderboard as a single player, each overwriting the other.
  'order20-device-id',
  // A half-finished game is tied to the moment it was being played. Teleporting
  // one mid-move only creates odd states on the far side, so the new device
  // starts on a fresh board.
  'order20-current-game',
  'order20-current-daily-game',
  'order20-current-game-recorded',
  // Belongs to the half-finished daily above, and means nothing without it.
  'order20-daily-timer',
] as const

export type TransferSnapshot = Record<string, string>

export function gatherSnapshot(storage: Pick<Storage, 'getItem'>): TransferSnapshot {
  const snapshot: TransferSnapshot = {}

  for (const key of TRANSFERRED_KEYS) {
    const value = storage.getItem(key)
    // Absent keys are simply left out, so a player who has never changed a
    // setting doesn't push a wall of nulls onto the new device.
    if (value !== null) snapshot[key] = value
  }

  return snapshot
}

export function applySnapshot(snapshot: TransferSnapshot, storage: Pick<Storage, 'setItem'>): number {
  let applied = 0

  for (const key of TRANSFERRED_KEYS) {
    const value = snapshot[key]
    if (typeof value !== 'string') continue
    storage.setItem(key, value)
    applied += 1
  }

  return applied
}

// Anything not on the allowlist is dropped rather than trusted, so a payload
// that has been tampered with in transit cannot write arbitrary keys into the
// receiving device's storage.
export function parseSnapshot(raw: string): TransferSnapshot | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const source = parsed as Record<string, unknown>
  const snapshot: TransferSnapshot = {}
  for (const key of TRANSFERRED_KEYS) {
    const value = source[key]
    if (typeof value === 'string') snapshot[key] = value
  }

  return snapshot
}

// Used by the confirmation screen, so it can say what actually arrived rather
// than a generic "done".
export interface SnapshotSummary {
  bestScore: number | null
  streakDays: number | null
  achievements: number | null
  name: string | null
}

function readNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function describeSnapshot(snapshot: TransferSnapshot): SnapshotSummary {
  let streakDays: number | null = null
  let achievements: number | null = null

  try {
    const streak = snapshot['order20-daily-streak']
    if (streak) {
      const parsed = JSON.parse(streak) as { count?: unknown }
      if (typeof parsed?.count === 'number') streakDays = parsed.count
    }
  } catch {
    // A snapshot from an older version, or simply malformed. The move still
    // worked; only this one line of the summary goes unsaid.
  }

  try {
    const unlocked = snapshot['order20-achievements-unlocked']
    if (unlocked) {
      const parsed = JSON.parse(unlocked) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') achievements = Object.keys(parsed).length
    }
  } catch {
    // As above.
  }

  return {
    bestScore: readNumber(snapshot['order20-best-score']),
    streakDays,
    achievements,
    name: snapshot['order20-leaderboard-name'] ?? null,
  }
}
