import { describe, expect, it } from 'vitest'
import {
  SHORT_BOARD_SIZE,
  createEmptyShortRecord,
  isShortRecord,
  recordShortGame,
  revealCopy,
  type CommunityRecord,
} from './shortBoard'

function community(overrides: Partial<CommunityRecord> = {}): CommunityRecord {
  return { games: 644, players: 9, wins: 0, ...overrides }
}

describe('the short board size', () => {
  it('is small enough to finish and big enough to mean something', () => {
    // Four is won a third of the time and five nearly a quarter, which makes
    // finishing one worth nothing. Anything past eight is back to a grind.
    expect(SHORT_BOARD_SIZE).toBeGreaterThan(5)
    expect(SHORT_BOARD_SIZE).toBeLessThan(9)
  })
})

describe('the short board record', () => {
  it('starts empty', () => {
    expect(createEmptyShortRecord()).toEqual({ games: 0, wins: 0, currentStreak: 0, bestStreak: 0 })
  })

  it('counts a loss as a game but not a win', () => {
    expect(recordShortGame(createEmptyShortRecord(), false)).toEqual({
      games: 1,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0,
    })
  })

  it('builds a streak across consecutive wins', () => {
    let record = createEmptyShortRecord()
    record = recordShortGame(record, true)
    record = recordShortGame(record, true)

    expect(record).toEqual({ games: 2, wins: 2, currentStreak: 2, bestStreak: 2 })
  })

  it('keeps the best streak when a loss ends the current one', () => {
    let record = createEmptyShortRecord()
    record = recordShortGame(record, true)
    record = recordShortGame(record, true)
    record = recordShortGame(record, false)

    expect(record.currentStreak).toBe(0)
    expect(record.bestStreak).toBe(2)

    // A shorter new streak must not lower the record.
    record = recordShortGame(record, true)
    expect(record.bestStreak).toBe(2)
  })

  it('does not mutate what it is given', () => {
    const record = createEmptyShortRecord()
    recordShortGame(record, true)

    expect(record.games).toBe(0)
  })

  it('rejects anything that is not a record, so bad storage resets rather than crashes', () => {
    expect(isShortRecord({ games: 1, wins: 0, currentStreak: 0, bestStreak: 0 })).toBe(true)
    expect(isShortRecord({ games: 1 })).toBe(false)
    expect(isShortRecord(null)).toBe(false)
    expect(isShortRecord('3')).toBe(false)
  })
})

describe('the reveal, when nobody has won', () => {
  it('says so, with the real count behind it', () => {
    const copy = revealCopy(community(), 84)

    expect(copy.headline).toBe('Nobody has ever won')
    expect(copy.lines[0]).toContain('644 games counted between 9 of you')
  })

  it('says counted rather than ever, because the log does not reach back', () => {
    // game_log started partway through this app's life, so claiming these are
    // all the games ever played would be untrue.
    expect(revealCopy(community(), 84).lines[0]).toContain('counted')
    expect(revealCopy(community(), 84).lines.join(' ')).not.toContain('ever played')
  })

  it('puts thousands separators in, since this number will get long', () => {
    expect(revealCopy(community({ games: 12400 }), 84).lines[0]).toContain('12,400')
  })
})

describe('the reveal, once somebody has won', () => {
  // The whole reason this is generated rather than written out. If the copy
  // kept insisting nobody had ever done it, the joke would become a bug the
  // day somebody did.
  it('stops claiming nobody has, and says how many', () => {
    const copy = revealCopy(community({ wins: 1 }), 84)

    expect(copy.headline).toBe('It has happened. Once.')
    expect(copy.lines[0]).toContain('One full board in 644 games')
  })

  it('counts past one properly', () => {
    const copy = revealCopy(community({ wins: 3 }), 84)

    expect(copy.headline).toBe('It has happened 3 times')
    expect(copy.lines[0]).toContain('3 full boards')
  })

  it('never claims nobody has won when somebody has', () => {
    for (const wins of [1, 2, 17]) {
      const copy = revealCopy(community({ wins }), 84)
      expect(`${copy.headline} ${copy.lines.join(' ')}`).not.toMatch(/nobody|not one full board/i)
    }
  })
})

describe('the reveal, with no answer from the worker', () => {
  it('falls back to the player, which needs no network to be true', () => {
    const copy = revealCopy(null, 84)

    expect(copy.headline).toBe('You have never won')
    expect(copy.lines[0]).toContain('84 games on this device')
  })

  it('does not claim a count for somebody who has never played', () => {
    const copy = revealCopy(null, 0)

    expect(copy.lines[0]).not.toContain('0 games')
  })

  it('says game rather than games for exactly one', () => {
    expect(revealCopy(null, 1).lines[0]).toContain('1 game on this device')
  })
})

describe('what every version of the reveal offers', () => {
  it('names the size and the odds', () => {
    for (const record of [null, community(), community({ wins: 1 })]) {
      const copy = revealCopy(record, 84)
      expect(copy.offer).toContain('Six positions')
      expect(copy.offer).toContain('one in seven')
    }
  })
})
