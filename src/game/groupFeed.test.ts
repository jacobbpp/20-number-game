import { describe, expect, it } from 'vitest'
import { ANONYMOUS_PLAYER, describeMode, displayName, formatRelativeTime } from './groupFeed'

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
