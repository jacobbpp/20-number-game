import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { rollUpDay, type FeedSnapshot } from '../src/index'

// This version of @cloudflare/vitest-pool-workers has no isolatedStorage
// option, so the D1 database is shared by every test in the file and rows
// written by one are still there for the next. These assertions are about
// exact counts, so without this they'd pass or fail on execution order.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM game_log'),
    env.DB.prepare('DELETE FROM streaks'),
    env.DB.prepare('DELETE FROM daily_summary'),
  ])
})

async function logGame(options: {
  deviceId: string
  name?: string | null
  date: string
  mode?: string
  boardSize?: number
  placedCount: number
}) {
  const { deviceId, name = null, date, mode = 'freeplay', boardSize = 20, placedCount } = options
  await env.DB.prepare(
    `INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(deviceId, name, date, mode, boardSize, placedCount, `${date}T12:00:00.000Z`)
    .run()
}

async function saveStreakName(deviceId: string, name: string, date: string) {
  await env.DB.prepare(
    `INSERT INTO streaks (device_id, name, streak_count, last_played_date, updated_at)
     VALUES (?1, ?2, 1, ?3, ?3)`,
  )
    .bind(deviceId, name, date)
    .run()
}

const NOW = '2026-03-02T00:10:00.000Z'

describe('nightly roll-up', () => {
  it('counts games and distinct players, and names the busiest', async () => {
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 9 })
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 11 })
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 4 })
    await logGame({ deviceId: 'dev-b', name: 'BBB', date: '2026-03-01', placedCount: 7 })
    // A different day entirely, which must not leak into the total.
    await logGame({ deviceId: 'dev-c', name: 'CCC', date: '2026-02-28', placedCount: 20 })

    const summary = await rollUpDay(env, '2026-03-01', NOW)

    expect(summary.games).toBe(4)
    expect(summary.players).toBe(2)
    expect(summary.busiestName).toBe('AAA')
    expect(summary.busiestGames).toBe(3)
  })

  it('ranks the best run by share of the board filled, not raw count', async () => {
    // 17/20 is 0.85, 25/30 is 0.83 — ordering on raw placed_count alone would
    // wrongly hand it to the bigger board every time.
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', boardSize: 20, placedCount: 17 })
    await logGame({ deviceId: 'device-bbb', name: 'BBB', date: '2026-03-01', mode: 'daily', boardSize: 30, placedCount: 25 })

    const summary = await rollUpDay(env, '2026-03-01', NOW)

    expect(summary.bestName).toBe('AAA')
    expect(summary.bestScore).toBe(17)
    expect(summary.bestBoardSize).toBe(20)
  })

  it('falls back to the streaks table when a game was logged before a name was chosen', async () => {
    await saveStreakName('dev-a', 'LATER', '2026-03-01')
    await logGame({ deviceId: 'dev-a', name: null, date: '2026-03-01', placedCount: 12 })

    const summary = await rollUpDay(env, '2026-03-01', NOW)

    expect(summary.busiestName).toBe('LATER')
    expect(summary.bestName).toBe('LATER')
  })

  it('leaves the name null when a device has never saved one anywhere', async () => {
    await logGame({ deviceId: 'dev-anon', name: null, date: '2026-03-01', placedCount: 6 })

    const summary = await rollUpDay(env, '2026-03-01', NOW)

    expect(summary.games).toBe(1)
    expect(summary.busiestName).toBeNull()
  })

  it('still writes a row for a day nobody played', async () => {
    const summary = await rollUpDay(env, '2026-03-01', NOW)

    expect(summary.games).toBe(0)
    expect(summary.players).toBe(0)
    expect(summary.busiestName).toBeNull()
    expect(summary.bestScore).toBeNull()

    const row = await env.DB.prepare('SELECT games FROM daily_summary WHERE date = ?1').bind('2026-03-01').first<{ games: number }>()
    expect(row?.games).toBe(0)
  })

  it('upserts rather than duplicating when the same day is rolled up twice', async () => {
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 9 })
    await rollUpDay(env, '2026-03-01', NOW)

    // A retried cron invocation, after one more game landed late.
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 14 })
    await rollUpDay(env, '2026-03-01', NOW)

    const rows = await env.DB.prepare('SELECT games FROM daily_summary WHERE date = ?1').bind('2026-03-01').all<{ games: number }>()
    expect(rows.results).toHaveLength(1)
    expect(rows.results[0].games).toBe(2)
  })
})

describe('GET /community/yesterday', () => {
  it('returns the summary for the day before the caller\'s today', async () => {
    await logGame({ deviceId: 'dev-a', name: 'AAA', date: '2026-03-01', placedCount: 15 })
    await rollUpDay(env, '2026-03-01', NOW)

    const response = await SELF.fetch('http://example.com/community/yesterday?today=2026-03-02')
    expect(response.status).toBe(200)

    const body = (await response.json()) as { date: string; summary: { games: number; bestName: string } | null }
    expect(body.date).toBe('2026-03-01')
    expect(body.summary?.games).toBe(1)
    expect(body.summary?.bestName).toBe('AAA')
  })

  it('returns a null summary, not an error, before the first nightly run', async () => {
    const response = await SELF.fetch('http://example.com/community/yesterday?today=2026-03-02')
    expect(response.status).toBe(200)

    const body = (await response.json()) as { date: string; summary: unknown }
    expect(body.date).toBe('2026-03-01')
    expect(body.summary).toBeNull()
  })

  it('rejects a missing or malformed today', async () => {
    expect((await SELF.fetch('http://example.com/community/yesterday')).status).toBe(400)
    expect((await SELF.fetch('http://example.com/community/yesterday?today=nonsense')).status).toBe(400)
  })
})

// Asserts the write actually happened. Without this a body that fails
// validation just 204s past you as a silent 400 and the feed assertions
// further down fail somewhere unrelated — deviceId has an 8-character
// minimum, which is easy to trip with a short fixture id.
async function postGame(body: Record<string, unknown>) {
  const response = await SELF.fetch('http://example.com/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(response.status).toBe(204)
  return response
}

// The Durable Object's own storage is shared across these tests too, and
// unlike D1 there's no way to clear it without adding a reset method that
// would exist purely for tests. So these use a device id of their own per
// test and assert on that person's rows, rather than on the whole board.
describe('best runs board', () => {
  async function boardFor(deviceId?: string) {
    const url = deviceId ? `http://example.com/activity?deviceId=${deviceId}` : 'http://example.com/activity'
    const response = await SELF.fetch(url)
    expect(response.status).toBe(200)
    return (await response.json()) as FeedSnapshot
  }

  it('ranks by share of the board filled, not by raw count', async () => {
    // 15 of 15 beats 12 of 20 despite the smaller number, the same rule the
    // nightly roll-up uses. Ordering on placedCount alone would invert this.
    await postGame({ deviceId: 'rank-aaa', name: 'AAA', date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount: 12 })
    await postGame({ deviceId: 'rank-bbb', name: 'BBB', date: '2026-03-01', mode: 'daily', boardSize: 15, placedCount: 15 })

    const board = await boardFor()
    const ranked = board.events.filter(event => event.name === 'AAA' || event.name === 'BBB')
    expect(ranked[0].name).toBe('BBB')
    expect(ranked[1].name).toBe('AAA')
  })

  it('keeps a run from an unnamed device rather than dropping it', async () => {
    await postGame({ deviceId: 'anon-device', name: null, date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount: 5 })

    const board = await boardFor()
    const anon = board.events.find(event => event.name === null && event.placedCount === 5)
    expect(anon).toBeDefined()
  })

  it('shows only a person\'s three best runs, however many they play', async () => {
    for (let i = 1; i <= 12; i++) {
      await postGame({ deviceId: 'busy-device', name: 'BUSY', date: '2026-03-01', mode: 'daily', boardSize: 30, placedCount: i })
    }

    const board = await boardFor()
    const theirs = board.events.filter(event => event.name === 'BUSY')

    // One long session must not push everyone else off the board.
    expect(theirs).toHaveLength(3)
    expect(theirs.map(event => event.placedCount)).toEqual([12, 11, 10])
  })

  it('gives every run an id, so a reaction has something to attach to', async () => {
    await postGame({ deviceId: 'ident-device', name: 'IDENT', date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount: 16 })

    const board = await boardFor()
    const run = board.events.find(event => event.name === 'IDENT')
    expect(run?.id).toBeGreaterThan(0)
  })

  it('reports nobody connected when read over plain HTTP', async () => {
    const snapshot = (await (await SELF.fetch('http://example.com/activity')).json()) as FeedSnapshot
    expect(snapshot.playing).toBe(0)
  })

  it('rejects a websocket upgrade sent straight to the object without one', async () => {
    const stub = env.ACTIVITY.getByName('group')
    const response = await stub.fetch('http://example.com/activity')
    expect(response.status).toBe(426)
  })
})

// Grouping is by name first, which is what makes "three each" true on the
// screen a person actually reads. These cover the two ways that matters.
describe('who counts as one person', () => {
  async function board() {
    return (await (await SELF.fetch('http://example.com/activity')).json()) as FeedSnapshot
  }

  it('treats the same name on two devices as one person', async () => {
    // Exactly what Move my game produces: the device id deliberately changes,
    // but it is still one player and should still get three slots, not six.
    for (let i = 1; i <= 4; i++) {
      await postGame({ deviceId: 'moved-old-device', name: 'MOVER', date: '2026-03-01', mode: 'daily', boardSize: 30, placedCount: i })
    }
    for (let i = 5; i <= 8; i++) {
      await postGame({ deviceId: 'moved-new-device', name: 'MOVER', date: '2026-03-01', mode: 'daily', boardSize: 30, placedCount: i })
    }

    const theirs = (await board()).events.filter(event => event.name === 'MOVER')
    expect(theirs).toHaveLength(3)
    expect(theirs.map(event => event.placedCount)).toEqual([8, 7, 6])
  })

  it('keeps two unnamed devices apart rather than merging them', async () => {
    // With no name to group on it falls back to the device, so one anonymous
    // player cannot eat the other's slots.
    for (let i = 1; i <= 4; i++) {
      await postGame({ deviceId: 'anon-one-device', name: null, date: '2026-03-01', mode: 'daily', boardSize: 25, placedCount: i })
      await postGame({ deviceId: 'anon-two-device', name: null, date: '2026-03-01', mode: 'daily', boardSize: 25, placedCount: i })
    }

    const anon = (await board()).events.filter(event => event.name === null && event.boardSize === 25)
    // Three each, from two distinct devices.
    expect(anon).toHaveLength(6)
  })
})
