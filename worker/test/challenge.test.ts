import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

interface Challenge {
  code: string
  boardSize: number
  challengerName: string
  challengerScore: number | null
  opponentName: string | null
  opponentScore: number | null
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM challenges').run()
})

// These mint far more challenges than a person ever would and would otherwise
// share one rate limit bucket, so each call comes from its own address.
let caller = 0
function fromNewAddress() {
  caller += 1
  return { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${caller % 250}` }
}

function create(body: unknown) {
  return SELF.fetch('http://example.com/challenge', {
    method: 'POST',
    headers: fromNewAddress(),
    body: JSON.stringify(body),
  })
}

function answer(body: unknown) {
  return SELF.fetch('http://example.com/challenge/answer', {
    method: 'POST',
    headers: fromNewAddress(),
    body: JSON.stringify(body),
  })
}

function read(code: string, name?: string) {
  const suffix = name === undefined ? '' : `&name=${encodeURIComponent(name)}`
  return SELF.fetch(`http://example.com/challenge?code=${encodeURIComponent(code)}${suffix}`)
}

const VALID = { code: 'K7M2QP', boardSize: 20, name: 'JRC', score: 14 }

async function seedChallenge(overrides: Partial<typeof VALID> = {}) {
  const response = await create({ ...VALID, ...overrides })
  expect(response.status).toBe(204)
  return { ...VALID, ...overrides }.code
}

describe('POST /challenge', () => {
  it('stores a challenge for somebody who has just played', async () => {
    expect((await create(VALID)).status).toBe(204)
  })

  it('refuses a code that is already in play', async () => {
    // Handing the same code to two people would hand one of them the other's
    // game.
    await seedChallenge()

    expect((await create({ ...VALID, name: 'SJW', score: 9 })).status).toBe(409)
  })

  it('refuses a malformed code', async () => {
    expect((await create({ ...VALID, code: 'ABC' })).status).toBe(400)
    // 0, O, 1 and I are deliberately outside the alphabet.
    expect((await create({ ...VALID, code: 'ABC0DE' })).status).toBe(400)
    expect((await create({ ...VALID, code: 'abcdef' })).status).toBe(400)
  })

  it('refuses a score the board could not have produced', async () => {
    expect((await create({ ...VALID, score: 21 })).status).toBe(400)
    expect((await create({ ...VALID, score: -1 })).status).toBe(400)
    expect((await create({ ...VALID, score: 12.5 })).status).toBe(400)
  })

  it('refuses a board size the game never deals', async () => {
    expect((await create({ ...VALID, boardSize: 17 })).status).toBe(400)
  })

  it('refuses a missing or malformed name', async () => {
    expect((await create({ ...VALID, name: '' })).status).toBe(400)
    expect((await create({ ...VALID, name: 'WAY TOO LONG' })).status).toBe(400)
  })

  it('sweeps expired challenges when a new one is made', async () => {
    await env.DB.prepare(
      `INSERT INTO challenges (code, board_size, challenger_name, challenger_score, created_at, expires_at)
       VALUES ('ZZZ999', 20, 'OLD', 5, '2020-01-01T00:00:00.000Z', '2020-01-08T00:00:00.000Z')`,
    ).run()

    await seedChallenge()

    const stale = await env.DB.prepare('SELECT code FROM challenges WHERE code = ?1').bind('ZZZ999').first()
    expect(stale).toBeNull()
  })
})

describe('GET /challenge, before it has been answered', () => {
  it('hides the challengers score from everybody else', async () => {
    // Knowing the target changes how you play for it.
    const code = await seedChallenge()

    const body = (await (await read(code, 'SJW')).json()) as { challenge: Challenge }
    expect(body.challenge.challengerScore).toBeNull()
    expect(body.challenge.challengerName).toBe('JRC')
    expect(body.challenge.boardSize).toBe(20)
  })

  it('hides it from somebody who gives no name at all', async () => {
    const code = await seedChallenge()

    const body = (await (await read(code)).json()) as { challenge: Challenge }
    expect(body.challenge.challengerScore).toBeNull()
  })

  it('shows the challenger their own score, since they already know it', async () => {
    const code = await seedChallenge()

    const body = (await (await read(code, 'JRC')).json()) as { challenge: Challenge }
    expect(body.challenge.challengerScore).toBe(14)
  })

  it('never leaks the score in the raw response either', async () => {
    const code = await seedChallenge({ score: 17 })

    expect(await (await read(code, 'SJW')).text()).not.toContain('17')
  })

  it('reads a code the way somebody would actually type it', async () => {
    const code = await seedChallenge()

    expect((await read(code.toLowerCase())).status).toBe(200)
    expect((await read(`  ${code}  `)).status).toBe(200)
  })

  it('refuses a code that never existed', async () => {
    expect((await read('ZZZZZZ')).status).toBe(404)
  })

  it('refuses one that has expired', async () => {
    await env.DB.prepare(
      `INSERT INTO challenges (code, board_size, challenger_name, challenger_score, created_at, expires_at)
       VALUES ('EXPRED', 20, 'OLD', 5, '2020-01-01T00:00:00.000Z', '2020-01-08T00:00:00.000Z')`,
    ).run()

    expect((await read('EXPRED')).status).toBe(404)
  })
})

describe('POST /challenge/answer', () => {
  it('records the answer and hands back both scores', async () => {
    const code = await seedChallenge()

    const response = await answer({ code, name: 'SJW', score: 16 })
    expect(response.status).toBe(200)

    const { challenge } = (await response.json()) as { challenge: Challenge }
    expect(challenge.challengerScore).toBe(14)
    expect(challenge.opponentScore).toBe(16)
    expect(challenge.opponentName).toBe('SJW')
  })

  it('opens the challengers score up to everyone once it is settled', async () => {
    const code = await seedChallenge()
    await answer({ code, name: 'SJW', score: 16 })

    const body = (await (await read(code, 'NOSY')).json()) as { challenge: Challenge }
    expect(body.challenge.challengerScore).toBe(14)
    expect(body.challenge.opponentScore).toBe(16)
  })

  it('can only be answered once', async () => {
    // Otherwise somebody could replay the same board until they beat it,
    // which is the one thing a head to head has to rule out.
    const code = await seedChallenge()
    expect((await answer({ code, name: 'SJW', score: 9 })).status).toBe(200)

    const second = await answer({ code, name: 'SJW', score: 19 })
    expect(second.status).toBe(409)

    const body = (await (await read(code)).json()) as { challenge: Challenge }
    expect(body.challenge.opponentScore).toBe(9)
  })

  it('lets only one of two people racing the same code win', async () => {
    const code = await seedChallenge()

    const [a, b] = await Promise.all([answer({ code, name: 'SJW', score: 9 }), answer({ code, name: 'YRC', score: 11 })])
    expect([a.status, b.status].sort()).toEqual([200, 409])
  })

  it('refuses a score the board could not have produced', async () => {
    // Ten slots, so eleven is not a score this board could have given anyone.
    const code = await seedChallenge({ boardSize: 10, code: 'AAA222', score: 8 })

    expect((await answer({ code, name: 'SJW', score: 11 })).status).toBe(400)
  })

  it('refuses a code that never existed', async () => {
    expect((await answer({ code: 'ZZZZZZ', name: 'SJW', score: 9 })).status).toBe(404)
  })

  it('refuses a body that is not JSON', async () => {
    const response = await SELF.fetch('http://example.com/challenge/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(response.status).toBe(400)
  })
})
