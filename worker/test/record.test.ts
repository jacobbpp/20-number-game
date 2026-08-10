import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

interface Record {
  games: number
  players: number
  wins: number
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM game_log').run()
})

async function logGame(deviceId: string, boardSize: number, placedCount: number) {
  await env.DB.prepare(
    'INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(deviceId, 'TEST', '2026-08-10', 'freeplay', boardSize, placedCount, '2026-08-10T09:00:00.000Z')
    .run()
}

async function record(): Promise<Record> {
  const response = await SELF.fetch('http://example.com/community/record')
  expect(response.status).toBe(200)
  return (await response.json()) as Record
}

describe('GET /community/record', () => {
  it('counts every logged game and the people behind them', async () => {
    await logGame('device-aaa-1', 20, 9)
    await logGame('device-aaa-1', 20, 12)
    await logGame('device-bbb-2', 25, 14)

    expect(await record()).toEqual({ games: 3, players: 2, wins: 0 })
  })

  it('reports zero for everything rather than failing on an empty log', async () => {
    // SUM over no rows is null, not zero, and the app prints this number.
    expect(await record()).toEqual({ games: 0, players: 0, wins: 0 })
  })

  it('counts a filled board as a win', async () => {
    await logGame('device-aaa-1', 20, 20)
    await logGame('device-aaa-1', 20, 19)

    expect((await record()).wins).toBe(1)
  })

  it('counts a win on any board size, not just twenty', async () => {
    await logGame('device-aaa-1', 25, 25)
    await logGame('device-bbb-2', 10, 10)

    expect((await record()).wins).toBe(2)
  })

  it('does not mistake a high score on a big board for a win', async () => {
    // 19 of 25 is a better run than 10 of 10 but it is not a finished board,
    // and this number is the one the app uses to claim nobody has ever won.
    await logGame('device-aaa-1', 25, 19)

    expect((await record()).wins).toBe(0)
  })

  it('is readable without a device id, since it is not about the reader', async () => {
    await logGame('device-aaa-1', 20, 9)

    const response = await SELF.fetch('http://example.com/community/record')
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://jacobbpp.github.io')
  })
})
