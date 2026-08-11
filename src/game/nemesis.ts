// Who keeps beating you, worked out from the daily challenge.
//
// The daily is the only board everyone plays identically: same rolls, same
// size, same day. That makes it the one place two scores can honestly be
// compared. Free play deals a different board every game, so a higher score
// there says nothing about who played better.

export interface HeadToHead {
  name: string
  // Days both of them submitted a daily score.
  days: number
  won: number
  lost: number
  drew: number
}

// Below this, one unlucky morning looks like a rivalry. Five shared days is
// enough for the record to mean something without waiting a month.
export const MIN_SHARED_DAYS = 5

function eligible(record: HeadToHead): boolean {
  return record.days >= MIN_SHARED_DAYS
}

// Most losses first, because a nemesis is whoever has actually beaten you
// most often. Two people level on losses are split by how often they manage
// it, so somebody who has beaten you five times in eight days outranks
// somebody who took five in nineteen.
export function pickNemesis(records: readonly HeadToHead[]): HeadToHead | null {
  const candidates = records.filter(record => eligible(record) && record.lost > 0)
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    if (b.lost !== a.lost) return b.lost - a.lost
    const rate = b.lost / b.days - a.lost / a.days
    if (rate !== 0) return rate
    if (b.days !== a.days) return b.days - a.days
    // Names last, so the same data always names the same person.
    return a.name.localeCompare(b.name)
  })[0]
}

// The other side of it. Somebody you have played plenty and who has never
// once come out ahead. A record of nothing but draws does not count: that is
// a stalemate rather than a run of beating them.
export function pickNeverBeaten(records: readonly HeadToHead[]): HeadToHead | null {
  const candidates = records.filter(record => eligible(record) && record.lost === 0 && record.won > 0)
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    if (b.days !== a.days) return b.days - a.days
    if (b.won !== a.won) return b.won - a.won
    return a.name.localeCompare(b.name)
  })[0]
}

// Everybody worth offering as an opponent for a head to head, most-played
// first. No MIN_SHARED_DAYS here: one shared morning is not enough to call
// somebody a nemesis, but it is plenty to send them a code. Capped because
// this is a row of buttons on a phone, and the people at the bottom of a long
// list are the ones least likely to answer anyway.
export const MAX_CHALLENGE_ROSTER = 8

export function challengeRoster(records: readonly HeadToHead[], limit = MAX_CHALLENGE_ROSTER): string[] {
  return [...records]
    .sort((a, b) => (b.days !== a.days ? b.days - a.days : a.name.localeCompare(b.name)))
    .slice(0, limit)
    .map(record => record.name)
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

export function describeNemesis(record: HeadToHead): string {
  const days = `${record.days} shared ${plural(record.days, 'day', 'days')}`

  // On a board everyone plays with the same rolls, level is routinely the
  // single most common outcome: more often than either of them wins. Where
  // that holds it gets said, because a bare win-loss line would be quietly
  // dropping the largest part of the record.
  if (record.drew > record.won && record.drew > record.lost) {
    return `${days} on the same board, ${record.drew} of them level. They have taken ${record.lost}.`
  }

  return `${days} on the same board. They have taken ${record.lost} of ${plural(record.lost, 'it', 'them')}.`
}

export function describeNeverBeaten(record: HeadToHead): string {
  return `${record.days} shared ${plural(record.days, 'day', 'days')}, and not one of them theirs.`
}
