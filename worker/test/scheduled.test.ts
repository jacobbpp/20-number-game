import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import worker, { yesterday } from '../src/index'

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM game_log'), env.DB.prepare('DELETE FROM daily_summary')])
})

async function logGame(date: string, deviceId: string, placedCount: number) {
  await env.DB.prepare(
    `INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at)
     VALUES (?1, ?2, ?3, 'freeplay', 20, ?4, ?5)`,
  )
    .bind(deviceId, 'AAA', date, placedCount, `${date}T12:00:00.000Z`)
    .run()
}

// Runs the cron handler as the platform would, with a controller carrying the
// instant the schedule was meant to fire. No ExecutionContext is passed: the
// handler awaits its own work rather than deferring any of it to waitUntil,
// so it takes only the controller and env.
async function runCron(scheduledTime: string) {
  await worker.scheduled({ scheduledTime: Date.parse(scheduledTime), cron: '10 0 * * *', noRetry: () => {} }, env)
}

describe('yesterday', () => {
  it('steps back one ordinary day', () => {
    expect(yesterday('2026-03-15')).toBe('2026-03-14')
  })

  it('crosses a month boundary', () => {
    expect(yesterday('2026-03-01')).toBe('2026-02-28')
    expect(yesterday('2026-07-01')).toBe('2026-06-30')
  })

  it('crosses a year boundary', () => {
    expect(yesterday('2026-01-01')).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    // 2028 is a leap year, so the day before 1 March is the 29th, not the 28th.
    expect(yesterday('2028-03-01')).toBe('2028-02-29')
    expect(yesterday('2028-02-29')).toBe('2028-02-28')
  })

  it('is not tripped by the day the clocks change', () => {
    // British Summer Time starts on 29 March 2026. Everything here is anchored
    // to UTC, so the calendar step must stay exactly one day regardless.
    expect(yesterday('2026-03-29')).toBe('2026-03-28')
    expect(yesterday('2026-03-30')).toBe('2026-03-29')
  })
})

describe('nightly cron', () => {
  it('summarises the day that just ended, not the day it runs on', async () => {
    await logGame('2026-03-14', 'device-aaa', 12)
    await logGame('2026-03-14', 'device-bbb', 8)
    // Also a game from the day the cron itself fires, which must be left for
    // tomorrow's run rather than folded into this one.
    await logGame('2026-03-15', 'device-aaa', 19)

    await runCron('2026-03-15T00:10:00.000Z')

    const row = await env.DB.prepare('SELECT date, games, players FROM daily_summary').first<{
      date: string
      games: number
      players: number
    }>()
    expect(row?.date).toBe('2026-03-14')
    expect(row?.games).toBe(2)
    expect(row?.players).toBe(2)
  })

  it('rolls up the previous month on the first of a new one', async () => {
    await logGame('2026-02-28', 'device-aaa', 11)

    await runCron('2026-03-01T00:10:00.000Z')

    const row = await env.DB.prepare('SELECT date, games FROM daily_summary').first<{ date: string; games: number }>()
    expect(row?.date).toBe('2026-02-28')
    expect(row?.games).toBe(1)
  })

  it('rolls up the previous year on New Year\'s Day', async () => {
    await logGame('2025-12-31', 'device-aaa', 20)

    await runCron('2026-01-01T00:10:00.000Z')

    const row = await env.DB.prepare('SELECT date, games FROM daily_summary').first<{ date: string; games: number }>()
    expect(row?.date).toBe('2025-12-31')
  })

  it('uses the scheduled instant, so a late retry still covers the right day', async () => {
    await logGame('2026-03-14', 'device-aaa', 12)

    // Cloudflare hands back the time the run was scheduled for even when the
    // invocation itself is delayed. Reading the wall clock instead would make
    // a run that slipped past midnight summarise the wrong day entirely.
    await runCron('2026-03-15T00:10:00.000Z')

    const row = await env.DB.prepare('SELECT date FROM daily_summary').first<{ date: string }>()
    expect(row?.date).toBe('2026-03-14')
  })

  it('writes exactly one row when the same schedule fires twice', async () => {
    await logGame('2026-03-14', 'device-aaa', 12)

    await runCron('2026-03-15T00:10:00.000Z')
    await runCron('2026-03-15T00:10:00.000Z')

    const rows = await env.DB.prepare('SELECT date FROM daily_summary').all<{ date: string }>()
    expect(rows.results).toHaveLength(1)
  })

  it('still records a row for a completely quiet day', async () => {
    await runCron('2026-03-15T00:10:00.000Z')

    const row = await env.DB.prepare('SELECT date, games, players FROM daily_summary').first<{
      date: string
      games: number
      players: number
    }>()
    expect(row?.date).toBe('2026-03-14')
    expect(row?.games).toBe(0)
    expect(row?.players).toBe(0)
  })
})
