import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { FeedSnapshot } from '../src/index'

// Straight at the object rather than through /games, because the endpoint
// stamps the time itself and these tests are about runs of a particular age.
const feed = () => env.ACTIVITY.getByName('group')

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

async function record(over: Partial<Parameters<ReturnType<typeof feed>['record']>[0]> = {}) {
  await feed().record({
    deviceId: 'device-a',
    name: 'JRC',
    mode: 'freeplay',
    boardSize: 20,
    placedCount: 10,
    at: hoursAgo(1),
    ...over,
  })
}

async function board(viewer: string | null = null): Promise<FeedSnapshot> {
  return feed().snapshot(viewer)
}

describe('the 24 hour window', () => {
  it('leaves out a run older than the window even though nothing has been recorded since', async () => {
    // The panel is headed "last 24 hours". Sweeping only on write meant a
    // quiet spell left yesterday's runs sitting under it.
    await record({ deviceId: 'stale-device', name: 'STALE', at: hoursAgo(30), placedCount: 19 })

    const snapshot = await board()

    expect(snapshot.events.find(event => event.name === 'STALE')).toBeUndefined()
  })

  it('keeps one from just inside it', async () => {
    await record({ deviceId: 'fresh-device', name: 'FRESH', at: hoursAgo(23), placedCount: 18 })

    const snapshot = await board()

    expect(snapshot.events.find(event => event.name === 'FRESH')).toBeDefined()
  })
})

describe('telling one person from another', () => {
  it('gives every run by one person the same person', async () => {
    await record({ deviceId: 'grp-1', name: 'GRPA', placedCount: 12 })
    await record({ deviceId: 'grp-1', name: 'GRPA', placedCount: 11 })

    const mine = (await board()).events.filter(event => event.name === 'GRPA')

    expect(mine).toHaveLength(2)
    expect(mine[0].person).toBe(mine[1].person)
  })

  it('gives two different people different ones', async () => {
    await record({ deviceId: 'grp-2', name: 'GRPB', placedCount: 13 })
    await record({ deviceId: 'grp-3', name: 'GRPC', placedCount: 14 })

    const snapshot = await board()
    const b = snapshot.events.find(event => event.name === 'GRPB')
    const c = snapshot.events.find(event => event.name === 'GRPC')

    expect(b!.person).not.toBe(c!.person)
  })

  it('keeps two nameless devices apart', async () => {
    // Both read as "someone" on screen, so if they shared a person the panel
    // would collapse two players into one row.
    await record({ deviceId: 'anon-1', name: null, placedCount: 7 })
    await record({ deviceId: 'anon-2', name: null, placedCount: 6 })

    const nameless = (await board()).events.filter(event => event.name === null)

    expect(new Set(nameless.map(event => event.person)).size).toBe(nameless.length)
  })

  it('never hands out anything that could identify a device', async () => {
    await record({ deviceId: 'secret-device-id', name: null, placedCount: 5 })

    const raw = JSON.stringify(await board())

    expect(raw).not.toContain('secret-device-id')
    expect(typeof (await board()).events[0].person).toBe('number')
  })
})

describe('who has the game open', () => {
  it('counts nobody when the viewer is the only connection', async () => {
    // Over HTTP there is no socket at all, which is the same answer: the
    // count is other people, and telling you that you are online is noise.
    expect((await board('device-a')).playing).toBe(0)
  })
})
