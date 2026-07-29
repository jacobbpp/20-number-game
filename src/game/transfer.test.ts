import { describe, expect, it } from 'vitest'
import {
  DEVICE_LOCAL_KEYS,
  TRANSFERRED_KEYS,
  applySnapshot,
  describeSnapshot,
  gatherSnapshot,
  parseSnapshot,
  type TransferSnapshot,
} from './transfer'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  }
}

describe('what travels and what stays', () => {
  it('never lets a key be on both lists', () => {
    const overlap = TRANSFERRED_KEYS.filter(key => (DEVICE_LOCAL_KEYS as readonly string[]).includes(key))
    expect(overlap).toEqual([])
  })

  it('leaves the device id behind', () => {
    // The whole design rests on this: two devices sharing one id would both
    // write streaks as the same player.
    expect(TRANSFERRED_KEYS).not.toContain('order20-device-id')
    expect(DEVICE_LOCAL_KEYS).toContain('order20-device-id')
  })

  it('leaves a half-finished game behind', () => {
    expect(TRANSFERRED_KEYS).not.toContain('order20-current-game')
    expect(TRANSFERRED_KEYS).not.toContain('order20-current-daily-game')
  })

  it('carries the things a player would expect to keep', () => {
    for (const key of ['order20-stats', 'order20-best-score', 'order20-daily-streak', 'order20-achievements-unlocked', 'order20-leaderboard-name']) {
      expect(TRANSFERRED_KEYS).toContain(key)
    }
  })
})

describe('gatherSnapshot', () => {
  it('collects every transferable key that has a value', () => {
    const storage = fakeStorage({
      'order20-stats': '{"totalGames":12}',
      'order20-best-score': '18',
      'order20-leaderboard-name': 'JRC',
    })

    const snapshot = gatherSnapshot(storage)

    expect(snapshot['order20-stats']).toBe('{"totalGames":12}')
    expect(snapshot['order20-best-score']).toBe('18')
    expect(snapshot['order20-leaderboard-name']).toBe('JRC')
  })

  it('omits keys that were never set rather than sending nulls', () => {
    const snapshot = gatherSnapshot(fakeStorage({ 'order20-best-score': '18' }))

    expect(Object.keys(snapshot)).toEqual(['order20-best-score'])
  })

  it('does not pick up the device id even though it is in storage', () => {
    const snapshot = gatherSnapshot(fakeStorage({ 'order20-best-score': '18', 'order20-device-id': 'device-aaa' }))

    expect(snapshot['order20-device-id']).toBeUndefined()
  })

  it('does not pick up a game in progress', () => {
    const snapshot = gatherSnapshot(fakeStorage({ 'order20-current-game': '{"placedCount":7}', 'order20-best-score': '18' }))

    expect(snapshot['order20-current-game']).toBeUndefined()
  })
})

describe('applySnapshot', () => {
  it('writes the values onto the receiving device', () => {
    const storage = fakeStorage()

    const applied = applySnapshot({ 'order20-best-score': '18', 'order20-leaderboard-name': 'JRC' }, storage)

    expect(applied).toBe(2)
    expect(storage.data['order20-best-score']).toBe('18')
    expect(storage.data['order20-leaderboard-name']).toBe('JRC')
  })

  it('overwrites whatever was already there', () => {
    // The receiving screen warns about exactly this before it happens.
    const storage = fakeStorage({ 'order20-best-score': '4' })

    applySnapshot({ 'order20-best-score': '18' }, storage)

    expect(storage.data['order20-best-score']).toBe('18')
  })

  it('refuses to write a key that is not transferable, even if the payload contains one', () => {
    const storage = fakeStorage({ 'order20-device-id': 'mine' })

    applySnapshot({ 'order20-device-id': 'theirs', 'order20-best-score': '18' } as TransferSnapshot, storage)

    // A tampered payload must not be able to steal this device's identity.
    expect(storage.data['order20-device-id']).toBe('mine')
    expect(storage.data['order20-best-score']).toBe('18')
  })

  it('leaves an in-progress game on this device alone', () => {
    const storage = fakeStorage({ 'order20-current-game': '{"placedCount":3}' })

    applySnapshot({ 'order20-current-game': '{"placedCount":19}' } as TransferSnapshot, storage)

    expect(storage.data['order20-current-game']).toBe('{"placedCount":3}')
  })
})

describe('parseSnapshot', () => {
  it('reads back what gatherSnapshot produced', () => {
    const original = gatherSnapshot(fakeStorage({ 'order20-best-score': '18', 'order20-theme': 'light' }))

    expect(parseSnapshot(JSON.stringify(original))).toEqual(original)
  })

  it('drops any key that is not on the allowlist', () => {
    const parsed = parseSnapshot(JSON.stringify({ 'order20-best-score': '18', 'order20-device-id': 'theirs', 'evil-key': 'x' }))

    expect(parsed).toEqual({ 'order20-best-score': '18' })
  })

  it('ignores values that are not strings', () => {
    const parsed = parseSnapshot(JSON.stringify({ 'order20-best-score': 18, 'order20-theme': 'light' }))

    expect(parsed).toEqual({ 'order20-theme': 'light' })
  })

  it('returns null for anything that is not an object of values', () => {
    expect(parseSnapshot('not json')).toBeNull()
    expect(parseSnapshot('[1,2,3]')).toBeNull()
    expect(parseSnapshot('null')).toBeNull()
    expect(parseSnapshot('"a string"')).toBeNull()
  })
})

describe('describeSnapshot', () => {
  it('summarises what arrived', () => {
    const summary = describeSnapshot({
      'order20-best-score': '18',
      'order20-daily-streak': JSON.stringify({ count: 7, bestStreak: 9 }),
      'order20-achievements-unlocked': JSON.stringify({ 'first-win': 1, dedicated: 2, century: 3 }),
      'order20-leaderboard-name': 'JRC',
    })

    expect(summary).toEqual({ bestScore: 18, streakDays: 7, achievements: 3, name: 'JRC' })
  })

  it('reports nulls rather than guessing when a snapshot is sparse', () => {
    expect(describeSnapshot({})).toEqual({ bestScore: null, streakDays: null, achievements: null, name: null })
  })

  it('still summarises the rest when one stored value is malformed', () => {
    const summary = describeSnapshot({ 'order20-best-score': '18', 'order20-daily-streak': 'not json' })

    expect(summary.bestScore).toBe(18)
    expect(summary.streakDays).toBeNull()
  })
})
