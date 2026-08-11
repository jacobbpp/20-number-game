import { describe, expect, it } from 'vitest'
import {
  MAX_CHALLENGE_ROSTER,
  MIN_SHARED_DAYS,
  challengeRoster,
  describeNemesis,
  describeNeverBeaten,
  pickNemesis,
  pickNeverBeaten,
  type HeadToHead,
} from './nemesis'

function record(name: string, days: number, won: number, lost: number, drew: number): HeadToHead {
  return { name, days, won, lost, drew }
}

// The real record as it stood on 2026-08-11, kept as a fixture because it is
// the shape this was built for: a long rivalry that is nearly level, and a
// pile of draws on a board everybody plays identically.
const REAL = [
  record('SJW', 19, 6, 5, 8),
  record('YRC', 17, 7, 3, 7),
  record('ALR', 8, 4, 2, 2),
  record('DAD', 2, 0, 1, 1),
  record('ALEXANDR', 9, 5, 0, 4),
  record('NIG', 2, 2, 0, 0),
]

describe('against the real record', () => {
  it('names the person who has actually beaten you most', () => {
    expect(pickNemesis(REAL)?.name).toBe('SJW')
  })

  it('names the one who has played plenty and never come out ahead', () => {
    expect(pickNeverBeaten(REAL)?.name).toBe('ALEXANDR')
  })

  it('ignores the two-day rivals on either side', () => {
    // DAD has beaten you more often than nobody, and NIG has never beaten
    // you, but two days is a coincidence rather than a record.
    expect(pickNemesis(REAL)?.name).not.toBe('DAD')
    expect(pickNeverBeaten(REAL)?.name).not.toBe('NIG')
  })
})

describe('picking the nemesis', () => {
  it('is whoever has beaten you most, not whoever you have played most', () => {
    const records = [record('OFTEN', 30, 25, 2, 3), record('DEADLY', 10, 2, 6, 2)]

    expect(pickNemesis(records)?.name).toBe('DEADLY')
  })

  it('splits a tie on how often they manage it', () => {
    // Five in eight is a worse look than five in nineteen.
    const records = [record('SLOW', 19, 6, 5, 8), record('SHARP', 8, 1, 5, 2)]

    expect(pickNemesis(records)?.name).toBe('SHARP')
  })

  it('says nothing when nobody has ever beaten you', () => {
    expect(pickNemesis([record('ALEXANDR', 9, 5, 0, 4)])).toBeNull()
  })

  it('says nothing when the only rival is too new to count', () => {
    expect(pickNemesis([record('NEW', MIN_SHARED_DAYS - 1, 0, 3, 0)])).toBeNull()
  })

  it('counts a rival the moment there are enough shared days', () => {
    expect(pickNemesis([record('NEW', MIN_SHARED_DAYS, 0, 1, 4)])?.name).toBe('NEW')
  })

  it('says nothing at all with no record behind it', () => {
    expect(pickNemesis([])).toBeNull()
  })

  it('names the same person every time for the same data', () => {
    const tied = [record('BBB', 10, 5, 3, 2), record('AAA', 10, 5, 3, 2)]

    expect(pickNemesis(tied)?.name).toBe('AAA')
    expect(pickNemesis([...tied].reverse())?.name).toBe('AAA')
  })

  it('does not reorder what it was given', () => {
    const records = [record('AAA', 10, 5, 1, 4), record('BBB', 10, 1, 5, 4)]
    pickNemesis(records)

    expect(records[0].name).toBe('AAA')
  })
})

describe('picking who has never beaten you', () => {
  it('prefers the one you have shared most days with', () => {
    const records = [record('FEW', 6, 3, 0, 3), record('MANY', 14, 8, 0, 6)]

    expect(pickNeverBeaten(records)?.name).toBe('MANY')
  })

  it('ignores a record of nothing but draws', () => {
    // Never losing to somebody you have also never beaten is a stalemate,
    // not a run of getting the better of them.
    expect(pickNeverBeaten([record('LEVEL', 10, 0, 0, 10)])).toBeNull()
  })

  it('ignores anyone who has beaten you even once', () => {
    expect(pickNeverBeaten([record('ONCE', 12, 9, 1, 2)])).toBeNull()
  })
})

describe('how the record reads', () => {
  it('says how many days and how many they took', () => {
    // Eight level out of nineteen is not "most", but it is more than either
    // of them won, which is the thing worth saying.
    expect(describeNemesis(record('SJW', 19, 6, 5, 8))).toBe(
      '19 shared days on the same board, 8 of them level. They have taken 5.',
    )
  })

  it('drops the draws line when they are not the story', () => {
    expect(describeNemesis(record('SJW', 12, 4, 6, 2))).toBe(
      '12 shared days on the same board. They have taken 6 of them.',
    )
  })

  it('counts one properly on both sides', () => {
    expect(describeNemesis(record('SJW', 1, 0, 1, 0))).toContain('1 shared day')
    expect(describeNemesis(record('SJW', 6, 5, 1, 0))).toContain('taken 1 of it')
    expect(describeNeverBeaten(record('X', 1, 1, 0, 0))).toContain('1 shared day')
  })

  it('never counts a draw as a win for either of them', () => {
    const copy = describeNemesis(record('SJW', 19, 6, 5, 8))

    // Five taken, eight level, and nothing that reads as thirteen.
    expect(copy).toContain('taken 5')
    expect(copy).toContain('8 of them level')
    expect(copy).not.toContain('13')
  })
})

describe('who you can send a challenge to', () => {
  it('offers everybody, most-played first', () => {
    expect(challengeRoster(REAL)).toEqual(['SJW', 'YRC', 'ALEXANDR', 'ALR', 'DAD', 'NIG'])
  })

  it('offers people the nemesis rules leave out', () => {
    // Two shared days is not enough to call somebody a nemesis. It is plenty
    // to send them a code.
    const roster = challengeRoster([record('DAD', 2, 0, 1, 1)])

    expect(roster).toEqual(['DAD'])
    expect(pickNemesis([record('DAD', 2, 0, 1, 1)])).toBeNull()
  })

  it('splits a tie by name, so the same record always lists the same order', () => {
    const roster = challengeRoster([record('NIG', 2, 2, 0, 0), record('DAD', 2, 0, 1, 1)])

    expect(roster).toEqual(['DAD', 'NIG'])
  })

  it('stops at a row of buttons somebody can actually read', () => {
    const many = Array.from({ length: 20 }, (_, index) => record(`P${index}`, 20 - index, 1, 1, 1))

    expect(challengeRoster(many)).toHaveLength(MAX_CHALLENGE_ROSTER)
  })

  it('has nobody to offer before you have played anybody', () => {
    expect(challengeRoster([])).toEqual([])
  })
})
