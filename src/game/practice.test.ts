import { describe, expect, it } from 'vitest'
import { rollNumber } from './engine'
import { bucketForValue } from './stats'
import { bucketRange, createBiasedRng } from './practice'

describe('bucketRange', () => {
  it('maps a bucket to its 100-wide value span', () => {
    expect(bucketRange(0)).toEqual({ start: 1, end: 100 })
    expect(bucketRange(4)).toEqual({ start: 401, end: 500 })
    expect(bucketRange(9)).toEqual({ start: 901, end: 1000 })
  })
})

describe('createBiasedRng', () => {
  it('lands rolls inside the target bucket most of the time, but not always', () => {
    const rng = createBiasedRng(Math.random, 4)
    const used: number[] = []
    let inBucket = 0
    const rolls = 500

    for (let i = 0; i < rolls; i++) {
      const value = rollNumber(used, rng)
      used.push(value)
      if (bucketForValue(value) === 4) inBucket++
    }

    // Weighted 60/40, so comfortably more than a tenth of rolls should land
    // in the bucket, but not literally every single one.
    expect(inBucket).toBeGreaterThan(rolls / 10)
    expect(inBucket).toBeLessThan(rolls)
  })

  it('never produces a value outside 1-1000', () => {
    const rng = createBiasedRng(Math.random, 9)
    const used: number[] = []
    for (let i = 0; i < 200; i++) {
      const value = rollNumber(used, rng)
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(1000)
      used.push(value)
    }
  })
})
