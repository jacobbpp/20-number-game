import { describe, expect, it } from 'vitest'
import {
  ANONYMOUS_PLAYER,
  describeMode,
  displayName,
  fillShare,
  formatShare,
  groupByPerson,
  type FeedRun,
} from './groupFeed'
import { formatRelativeTime } from './groupFeed'

const NOW = Date.parse('2026-03-01T12:00:00.000Z')

describe('displayName', () => {
  it('uses the saved name when there is one', () => {
    expect(displayName('YRC')).toBe('YRC')
  })

  it('falls back for a device that has never saved a name', () => {
    expect(displayName(null)).toBe(ANONYMOUS_PLAYER)
    expect(displayName('')).toBe(ANONYMOUS_PLAYER)
    expect(displayName('   ')).toBe(ANONYMOUS_PLAYER)
  })
})

describe('formatRelativeTime', () => {
  it('reads as just now under a minute', () => {
    expect(formatRelativeTime('2026-03-01T11:59:30.000Z', NOW)).toBe('just now')
    expect(formatRelativeTime('2026-03-01T12:00:00.000Z', NOW)).toBe('just now')
  })

  it('counts minutes, then hours, then days', () => {
    expect(formatRelativeTime('2026-03-01T11:48:00.000Z', NOW)).toBe('12m')
    expect(formatRelativeTime('2026-03-01T11:01:00.000Z', NOW)).toBe('59m')
    expect(formatRelativeTime('2026-03-01T11:00:00.000Z', NOW)).toBe('1h')
    expect(formatRelativeTime('2026-02-28T13:00:00.000Z', NOW)).toBe('23h')
    expect(formatRelativeTime('2026-02-28T12:00:00.000Z', NOW)).toBe('1d')
    expect(formatRelativeTime('2026-02-26T12:00:00.000Z', NOW)).toBe('3d')
  })

  it('never reads as being in the future when a device clock runs ahead', () => {
    expect(formatRelativeTime('2026-03-01T12:05:00.000Z', NOW)).toBe('just now')
  })

  it('returns nothing for a timestamp it cannot parse', () => {
    expect(formatRelativeTime('not a date', NOW)).toBe('')
  })
})

describe('describeMode', () => {
  it('spells out the two modes for a reader', () => {
    expect(describeMode('daily')).toBe('daily')
    expect(describeMode('freeplay')).toBe('free play')
  })
})

function feedRun(over: Partial<FeedRun> = {}): FeedRun {
  return { id: 1, person: 0, name: 'JRC', mode: 'freeplay', boardSize: 20, placedCount: 10, at: '2026-03-01T11:00:00.000Z', ...over }
}

describe('ranking by how much of the board was filled', () => {
  it('rates a full small board above most of a big one', () => {
    // The whole reason the panel ranks on share: 30 of 30 is a better run than
    // 18 of 20, and raw score says the opposite.
    expect(fillShare(30, 30)).toBeGreaterThan(fillShare(18, 20))
  })

  it('reads as a whole percentage', () => {
    expect(formatShare(fillShare(14, 20))).toBe('70%')
    expect(formatShare(fillShare(9, 15))).toBe('60%')
    expect(formatShare(fillShare(1, 3))).toBe('33%')
  })

  it('survives a board size of zero rather than dividing by it', () => {
    expect(fillShare(0, 0)).toBe(0)
  })
})

describe('grouping runs by person', () => {
  // The live board on 2026-08-11, which is what made this necessary: nine rows
  // of which six were the same two people.
  const LIVE: FeedRun[] = [
    feedRun({ id: 1, person: 0, name: 'YRC', placedCount: 14 }),
    feedRun({ id: 2, person: 0, name: 'YRC', placedCount: 13 }),
    feedRun({ id: 3, person: 0, name: 'YRC', placedCount: 13 }),
    feedRun({ id: 4, person: 1, name: null, mode: 'daily', boardSize: 15, placedCount: 9 }),
    feedRun({ id: 5, person: 2, name: 'JRC', placedCount: 11 }),
    feedRun({ id: 6, person: 2, name: 'JRC', placedCount: 10 }),
    feedRun({ id: 7, person: 2, name: 'JRC', placedCount: 10 }),
    feedRun({ id: 8, person: 3, name: null, mode: 'daily', boardSize: 10, placedCount: 4 }),
    feedRun({ id: 9, person: 4, name: 'SJW', mode: 'daily', boardSize: 10, placedCount: 3 }),
  ]

  it('turns nine rows into one per person', () => {
    expect(groupByPerson(LIVE)).toHaveLength(5)
  })

  it('keeps the order it was given, which is best first', () => {
    expect(groupByPerson(LIVE).map(person => person.label)).toEqual(['YRC', 'someone', 'JRC', 'someone else', 'SJW'])
  })

  it('shows each person their best run and keeps the rest behind it', () => {
    const [yrc] = groupByPerson(LIVE)

    expect(yrc.best.placedCount).toBe(14)
    expect(yrc.runs).toHaveLength(3)
    expect(yrc.share).toBe(0.7)
  })

  it('tells two nameless people apart', () => {
    // Both would otherwise render as "someone", one above the other, which
    // reads as a duplicate row rather than as two players.
    const labels = groupByPerson(LIVE).map(person => person.label)

    expect(labels.filter(label => label.startsWith(ANONYMOUS_PLAYER))).toEqual(['someone', 'someone else'])
  })

  it('numbers a third nameless player rather than repeating itself', () => {
    const runs = [
      feedRun({ id: 1, person: 0, name: null }),
      feedRun({ id: 2, person: 1, name: '' }),
      feedRun({ id: 3, person: 2, name: '   ' }),
    ]

    expect(groupByPerson(runs).map(person => person.label)).toEqual(['someone', 'someone else', 'someone (3)'])
  })

  it('keeps one person as one person even where the name is padded', () => {
    const runs = [feedRun({ id: 1, person: 0, name: ' JRC ' }), feedRun({ id: 2, person: 0, name: 'JRC' })]
    const [only] = groupByPerson(runs)

    expect(groupByPerson(runs)).toHaveLength(1)
    expect(only.label).toBe('JRC')
  })

  it('has nothing to show on an empty board', () => {
    expect(groupByPerson([])).toEqual([])
  })
})
