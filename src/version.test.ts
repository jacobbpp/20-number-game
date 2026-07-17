import { describe, expect, it } from 'vitest'
import { compareVersions } from './version'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('is positive when a is newer than b', () => {
    expect(compareVersions('1.9.0', '1.7.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.8', '1.0.1')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('is negative when a is older than b', () => {
    expect(compareVersions('1.0.1', '1.0.8')).toBeLessThan(0)
  })

  it('handles differing segment counts', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0)
  })
})
