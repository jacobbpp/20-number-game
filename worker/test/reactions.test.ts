import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { REACTION_EMOJI, type FeedSnapshot } from '../src/index'

const [CLAP, FIRE, SCREAM, LAUGH] = REACTION_EMOJI

// The object's storage is shared across tests, so each one uses its own device
// ids and asserts only on its own run.
async function postRun(deviceId: string, name: string, placedCount: number) {
  const response = await SELF.fetch('http://example.com/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, name, date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount }),
  })
  expect(response.status).toBe(204)
}

async function board(viewer?: string) {
  const url = viewer ? `http://example.com/activity?deviceId=${viewer}` : 'http://example.com/activity'
  return (await (await SELF.fetch(url)).json()) as FeedSnapshot
}

async function findRun(name: string, viewer?: string) {
  const snapshot = await board(viewer)
  const run = snapshot.events.find(event => event.name === name)
  expect(run).toBeDefined()
  return run!
}

function react(body: Record<string, unknown>) {
  return SELF.fetch('http://example.com/activity/react', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('reacting to a run', () => {
  it('records a reaction and counts it', async () => {
    await postRun('react-owner-1', 'ROWNER1', 17)
    const run = await findRun('ROWNER1')

    expect((await react({ deviceId: 'reactor-aaa', eventId: run.id, emoji: CLAP })).status).toBe(204)

    const after = await findRun('ROWNER1')
    expect(after.reactions).toEqual([{ emoji: CLAP, count: 1 }])
  })

  it('counts different people separately', async () => {
    await postRun('react-owner-2', 'ROWNER2', 16)
    const run = await findRun('ROWNER2')

    await react({ deviceId: 'reactor-aaa', eventId: run.id, emoji: CLAP })
    await react({ deviceId: 'reactor-bbb', eventId: run.id, emoji: CLAP })
    await react({ deviceId: 'reactor-ccc', eventId: run.id, emoji: FIRE })

    const after = await findRun('ROWNER2')
    expect(after.reactions).toEqual([
      { emoji: CLAP, count: 2 },
      { emoji: FIRE, count: 1 },
    ])
  })

  it('lets one person hold only one reaction, switching rather than stacking', async () => {
    await postRun('react-owner-3', 'ROWNER3', 15)
    const run = await findRun('ROWNER3')

    await react({ deviceId: 'switcher-aaa', eventId: run.id, emoji: CLAP })
    await react({ deviceId: 'switcher-aaa', eventId: run.id, emoji: SCREAM })

    const after = await findRun('ROWNER3')
    // A count of one per emoji would mean the same person appearing twice.
    expect(after.reactions).toEqual([{ emoji: SCREAM, count: 1 }])
  })

  it('takes a reaction back when the emoji is null', async () => {
    await postRun('react-owner-4', 'ROWNER4', 14)
    const run = await findRun('ROWNER4')

    await react({ deviceId: 'remover-aaa', eventId: run.id, emoji: LAUGH })
    expect((await findRun('ROWNER4')).reactions).toHaveLength(1)

    await react({ deviceId: 'remover-aaa', eventId: run.id, emoji: null })
    expect((await findRun('ROWNER4')).reactions).toEqual([])
  })

  it('tells the viewer which reaction is theirs, and only theirs', async () => {
    await postRun('react-owner-5', 'ROWNER5', 13)
    const run = await findRun('ROWNER5')

    await react({ deviceId: 'viewer-mine', eventId: run.id, emoji: FIRE })
    await react({ deviceId: 'viewer-other', eventId: run.id, emoji: CLAP })

    expect((await findRun('ROWNER5', 'viewer-mine')).myReaction).toBe(FIRE)
    expect((await findRun('ROWNER5', 'viewer-other')).myReaction).toBe(CLAP)
    // Someone who hasn't reacted, and an anonymous read, both see nothing of
    // their own rather than someone else's.
    expect((await findRun('ROWNER5', 'viewer-third')).myReaction).toBeNull()
    expect((await findRun('ROWNER5')).myReaction).toBeNull()
  })

  it('never sends anyone else\'s device id to a client', async () => {
    await postRun('react-owner-6', 'ROWNER6', 12)
    const run = await findRun('ROWNER6')
    await react({ deviceId: 'secret-device-id', eventId: run.id, emoji: CLAP })

    const raw = await (await SELF.fetch('http://example.com/activity?deviceId=viewer-mine')).text()
    expect(raw).not.toContain('secret-device-id')
  })

  it('refuses an emoji that is not one of the four', async () => {
    await postRun('react-owner-7', 'ROWNER7', 11)
    const run = await findRun('ROWNER7')

    // Otherwise the board becomes a place to post arbitrary text.
    expect((await react({ deviceId: 'reactor-aaa', eventId: run.id, emoji: '💩' })).status).toBe(400)
    expect((await react({ deviceId: 'reactor-aaa', eventId: run.id, emoji: 'not an emoji at all' })).status).toBe(400)
    expect((await findRun('ROWNER7')).reactions).toEqual([])
  })

  it('rejects a malformed body', async () => {
    expect((await react({})).status).toBe(400)
    expect((await react({ deviceId: 'short', eventId: 1, emoji: CLAP })).status).toBe(400)
    expect((await react({ deviceId: 'reactor-aaa', eventId: 0, emoji: CLAP })).status).toBe(400)
    expect((await react({ deviceId: 'reactor-aaa', eventId: 'one', emoji: CLAP })).status).toBe(400)
  })

  it('keeps reactions in a fixed order however they arrive', async () => {
    await postRun('react-owner-8', 'ROWNER8', 10)
    const run = await findRun('ROWNER8')

    // Added last-to-first; the chips must not reshuffle on the way out.
    await react({ deviceId: 'order-ddd', eventId: run.id, emoji: LAUGH })
    await react({ deviceId: 'order-ccc', eventId: run.id, emoji: SCREAM })
    await react({ deviceId: 'order-bbb', eventId: run.id, emoji: FIRE })
    await react({ deviceId: 'order-aaa', eventId: run.id, emoji: CLAP })

    const after = await findRun('ROWNER8')
    expect(after.reactions.map(reaction => reaction.emoji)).toEqual([CLAP, FIRE, SCREAM, LAUGH])
  })

  it('leaves a run with no reactions with an empty list rather than a gap', async () => {
    await postRun('react-owner-9', 'ROWNER9', 9)

    const run = await findRun('ROWNER9')
    expect(run.reactions).toEqual([])
    expect(run.myReaction).toBeNull()
  })
})
