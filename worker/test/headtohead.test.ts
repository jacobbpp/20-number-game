import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

interface Record {
  name: string
  days: number
  won: number
  lost: number
  drew: number
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM daily_scores').run()
})

async function score(date: string, name: string, value: number, boardSize = 20) {
  await env.DB.prepare(
    'INSERT INTO daily_scores (board_size, challenge_date, name, score, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  )
    .bind(boardSize, date, name, value, `${date}T09:00:00.000Z`)
    .run()
}

async function headToHead(name: string): Promise<Record[]> {
  const response = await SELF.fetch(`http://example.com/community/head-to-head?name=${encodeURIComponent(name)}`)
  expect(response.status).toBe(200)
  return ((await response.json()) as { records: Record[] }).records
}

function against(records: Record[], name: string): Record | undefined {
  return records.find(record => record.name === name)
}

describe('the head to head record', () => {
  it('counts a win, a loss and a draw against the same person', async () => {
    await score('2026-08-01', 'JRC', 14)
    await score('2026-08-01', 'SJW', 12)
    await score('2026-08-02', 'JRC', 9)
    await score('2026-08-02', 'SJW', 15)
    await score('2026-08-03', 'JRC', 8)
    await score('2026-08-03', 'SJW', 8)

    expect(against(await headToHead('JRC'), 'SJW')).toEqual({ name: 'SJW', days: 3, won: 1, lost: 1, drew: 1 })
  })

  it('reads the same the other way round', async () => {
    await score('2026-08-01', 'JRC', 14)
    await score('2026-08-01', 'SJW', 12)

    expect(against(await headToHead('SJW'), 'JRC')).toEqual({ name: 'JRC', days: 1, won: 0, lost: 1, drew: 0 })
  })

  it('only counts days both of them actually played', async () => {
    // A day somebody sat out is not a win for anyone.
    await score('2026-08-01', 'JRC', 14)
    await score('2026-08-01', 'SJW', 12)
    await score('2026-08-02', 'JRC', 18)
    await score('2026-08-03', 'SJW', 17)

    expect(against(await headToHead('JRC'), 'SJW')?.days).toBe(1)
  })

  it('counts draws, which on a shared board are the common case', async () => {
    for (const date of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      await score(date, 'JRC', 10)
      await score(date, 'SJW', 10)
    }

    expect(against(await headToHead('JRC'), 'SJW')).toEqual({ name: 'SJW', days: 3, won: 0, lost: 0, drew: 3 })
  })

  it('takes each persons best when they submitted a day more than once', async () => {
    await score('2026-08-01', 'JRC', 8)
    await score('2026-08-01', 'JRC', 15)
    await score('2026-08-01', 'SJW', 12)

    expect(against(await headToHead('JRC'), 'SJW')).toEqual({ name: 'SJW', days: 1, won: 1, lost: 0, drew: 0 })
  })

  it('keeps every rival apart rather than lumping them together', async () => {
    await score('2026-08-01', 'JRC', 10)
    await score('2026-08-01', 'SJW', 14)
    await score('2026-08-01', 'YRC', 6)

    const records = await headToHead('JRC')
    expect(against(records, 'SJW')).toMatchObject({ lost: 1, won: 0 })
    expect(against(records, 'YRC')).toMatchObject({ lost: 0, won: 1 })
  })

  it('never reports the player against themselves', async () => {
    await score('2026-08-01', 'JRC', 10)
    await score('2026-08-02', 'JRC', 12)

    expect(against(await headToHead('JRC'), 'JRC')).toBeUndefined()
  })

  it('puts whoever has beaten you most at the front', async () => {
    for (const date of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      await score(date, 'JRC', 5)
      await score(date, 'SJW', 12)
    }
    await score('2026-08-04', 'JRC', 5)
    await score('2026-08-04', 'YRC', 12)

    expect((await headToHead('JRC'))[0].name).toBe('SJW')
  })

  it('returns nothing at all for somebody who has never played a daily', async () => {
    await score('2026-08-01', 'SJW', 12)

    expect(await headToHead('JRC')).toEqual([])
  })

  it('rejects a missing or malformed name', async () => {
    expect((await SELF.fetch('http://example.com/community/head-to-head')).status).toBe(400)
    expect((await SELF.fetch('http://example.com/community/head-to-head?name=')).status).toBe(400)
    // Longer than any name the score endpoints would ever have stored.
    expect((await SELF.fetch('http://example.com/community/head-to-head?name=ABCDEFGHI')).status).toBe(400)
    expect((await SELF.fetch('http://example.com/community/head-to-head?name=DROP%3B')).status).toBe(400)
  })
})
