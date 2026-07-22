import { BUCKET_SIZE } from './stats'

// Noticeable but not guaranteed — a practice run should still feel like a
// genuine game, just weighted toward the range that's actually giving
// trouble, not a rigged sequence.
export const PRACTICE_BIAS_WEIGHT = 0.6

export function bucketRange(bucket: number): { start: number; end: number } {
  return { start: bucket * BUCKET_SIZE + 1, end: (bucket + 1) * BUCKET_SIZE }
}

// Wraps a base rng so rollNumber (which computes floor(rng() * 1000) + 1)
// lands inside the given bucket most of the time. Never touches engine.ts —
// this only reshapes the numbers rollNumber's own formula receives, so the
// existing no-repeats/retry logic there keeps working unmodified.
export function createBiasedRng(baseRng: () => number, bucket: number): () => number {
  const { start, end } = bucketRange(bucket)
  const span = end - start + 1
  return () => {
    if (baseRng() < PRACTICE_BIAS_WEIGHT) {
      const offset = Math.floor(baseRng() * span)
      return (start - 1 + offset) / 1000
    }
    return baseRng()
  }
}
