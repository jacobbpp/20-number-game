import { describe, expect, it } from 'vitest'
import { sequenceColor } from './color'

describe('sequenceColor', () => {
  it('starts at coral', () => {
    expect(sequenceColor(0)).toBe('rgb(240 153 123)')
  })

  it('sits at purple exactly at the midpoint', () => {
    expect(sequenceColor(0.5)).toBe('rgb(107 90 158)')
  })

  it('ends at amber', () => {
    expect(sequenceColor(1)).toBe('rgb(239 159 39)')
  })

  it('clamps out-of-range fractions instead of extrapolating', () => {
    expect(sequenceColor(-0.5)).toBe(sequenceColor(0))
    expect(sequenceColor(1.5)).toBe(sequenceColor(1))
  })
})
