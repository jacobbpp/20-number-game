import { describe, expect, it } from 'vitest'
import { sequenceColor } from './color'

describe('sequenceColor', () => {
  it('starts at violet', () => {
    expect(sequenceColor(0)).toBe('rgb(111 95 142)')
  })

  it('sits halfway between violet and orange at the midpoint', () => {
    expect(sequenceColor(0.5)).toBe('rgb(159 119 119)')
  })

  it('ends at orange', () => {
    expect(sequenceColor(1)).toBe('rgb(207 143 95)')
  })

  it('clamps out-of-range fractions instead of extrapolating', () => {
    expect(sequenceColor(-0.5)).toBe(sequenceColor(0))
    expect(sequenceColor(1.5)).toBe(sequenceColor(1))
  })
})
