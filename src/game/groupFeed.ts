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

// Enough of a run to rank it and group it. Reactions and the rest ride along
// on whatever the caller actually holds.
export interface FeedRun {
  id: number
  // Which person this run belongs to, decided by the server: name first,
  // device second, so one person stays one person across a Move my game and
  // two nameless devices stay two people.
  person: number
  name: string | null
  mode: string
  boardSize: number
  placedCount: number
  at: string
}

export interface PersonRuns<T extends FeedRun> {
  person: number
  label: string
  // Their best run, which is the one the panel shows. The rest sit behind it.
  best: T
  runs: T[]
  share: number
}

// Share of the board filled, which is how runs are ranked: board sizes run
// from 10 to 30, so 30 of 30 beats 18 of 20 even though the raw numbers say
// otherwise. The panel shows this because without it the order looks arbitrary
// — 14/20 above 9/15 above 11/20 reads as random until you see 70, 60, 55.
export function fillShare(placedCount: number, boardSize: number): number {
  return boardSize > 0 ? placedCount / boardSize : 0
}

export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`
}

// Two of the devices here have never saved a name, so both would render as
// "someone" and read as a duplicate row. They are told apart by position.
//
// Which of them is "someone" can change between snapshots, since the order is
// by score. That is the cost of having no name, and it is a good deal cheaper
// than showing the same word twice.
function anonymousLabel(index: number): string {
  if (index === 0) return ANONYMOUS_PLAYER
  if (index === 1) return `${ANONYMOUS_PLAYER} else`
  return `${ANONYMOUS_PLAYER} (${index + 1})`
}

// One entry per person, their best run first. The server already ranks the
// runs, so first seen is best seen and the order it hands over is kept.
export function groupByPerson<T extends FeedRun>(runs: readonly T[]): PersonRuns<T>[] {
  const people: PersonRuns<T>[] = []
  const byPerson = new Map<number, PersonRuns<T>>()
  let nameless = 0

  for (const run of runs) {
    const existing = byPerson.get(run.person)
    if (existing) {
      existing.runs.push(run)
      continue
    }

    const named = run.name !== null && run.name.trim().length > 0
    const entry: PersonRuns<T> = {
      person: run.person,
      label: named ? run.name!.trim() : anonymousLabel(nameless++),
      best: run,
      runs: [run],
      share: fillShare(run.placedCount, run.boardSize),
    }
    byPerson.set(run.person, entry)
    people.push(entry)
  }

  return people
}
