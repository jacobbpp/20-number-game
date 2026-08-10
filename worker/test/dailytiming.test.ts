import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

const DATE = '2026-03-01'
const SIZE = 20

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM daily_scores').run()
})

async function submit(overrides: Record<string, unknown> = {}) {
  return SELF.fetch('http://example.com/daily-scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardSize: SIZE, date: DATE, name: 'AAA', score: 12, ...overrides }),
  })
}

async function board() {
  const response = await SELF.fetch(`http://example.com/daily-scores/leaderboard?boardSize=${SIZE}&date=${DATE}`)
  expect(response.status).toBe(200)
  return ((await response.json()) as { entries: { name: string; score: number; durationMs: number | null }[] }).entries
}

describe('submitting a timed daily score', () => {
  it('stores and returns the time', async () => {
    expect((await submit({ name: 'AAA', durationMs: 134_000 })).status).toBe(204)

    expect((await board())[0]).toMatchObject({ name: 'AAA', durationMs: 134_000 })
  })

  it('still accepts a score with no time, for a client cached before timing existed', async () => {
    expect((await submit({ name: 'OLD' })).status).toBe(204)

    expect((await board())[0].durationMs).toBeNull()
  })

  it('accepts an explicit null', async () => {
    expect((await submit({ name: 'AAA', durationMs: null })).status).toBe(204)
  })

  it('rejects a time that is negative, absurd, or not a number', async () => {
    expect((await submit({ durationMs: -1 })).status).toBe(400)
    // The clock pauses when the app is hidden, so no real run reaches a day.
    expect((await submit({ durationMs: 24 * 60 * 60 * 1000 + 1 })).status).toBe(400)
    expect((await submit({ durationMs: 'fast' })).status).toBe(400)
    // Infinity and NaN are deliberately not tested through here: JSON.stringify
    // turns both into null, which is a legitimately valid value. The finiteness
    // check still guards the function itself against a non-HTTP caller.
  })
})

describe('how the daily board ranks', () => {
  it('breaks a tie on time, not on who submitted first', async () => {
    // The old rule ordered purely by created_at, so JRC would have led simply
    // by playing earlier in the day.
    await submit({ name: 'JRC', score: 15, durationMs: 134_000 })
    await submit({ name: 'YRC', score: 15, durationMs: 112_000 })

    expect((await board()).map(entry => entry.name)).toEqual(['YRC', 'JRC'])
  })

  it('never lets a fast low score outrank a slow high one', async () => {
    await submit({ name: 'SLOW', score: 15, durationMs: 600_000 })
    await submit({ name: 'QUICK', score: 9, durationMs: 20_000 })

    expect((await board()).map(entry => entry.name)).toEqual(['SLOW', 'QUICK'])
  })

  it('puts an untimed score behind a timed one on the same score', async () => {
    // Everything recorded before this existed has no time. It keeps its place
    // on score, but a run someone actually timed wins the tie.
    await submit({ name: 'UNTIMED', score: 15 })
    await submit({ name: 'TIMED', score: 15, durationMs: 300_000 })

    expect((await board()).map(entry => entry.name)).toEqual(['TIMED', 'UNTIMED'])
  })

  it('falls back to submission order when neither run was timed', async () => {
    await submit({ name: 'FIRST', score: 15 })
    await submit({ name: 'SECOND', score: 15 })

    expect((await board()).map(entry => entry.name)).toEqual(['FIRST', 'SECOND'])
  })

  it('orders a full board correctly on score then time', async () => {
    await submit({ name: 'D', score: 14, durationMs: 281_000 })
    await submit({ name: 'B', score: 15, durationMs: 134_000 })
    await submit({ name: 'A', score: 15, durationMs: 112_000 })
    await submit({ name: 'C', score: 14, durationMs: 187_000 })

    expect((await board()).map(entry => entry.name)).toEqual(['A', 'B', 'C', 'D'])
  })
})
