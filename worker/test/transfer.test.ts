import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM transfers').run()
})

function create(payload: unknown) {
  return SELF.fetch('http://example.com/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function claim(body: unknown) {
  return SELF.fetch('http://example.com/transfer/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function status(code: string) {
  return SELF.fetch(`http://example.com/transfer/status?code=${encodeURIComponent(code)}`)
}

async function mintCode(payload = '{"order20-best-score":"18"}') {
  const response = await create({ payload })
  expect(response.status).toBe(200)
  return ((await response.json()) as { code: string }).code
}

// Inserts a row the endpoints would never produce, for the expiry and sweep
// cases. The code is asserted to be well-formed first: a fixture using a
// character the alphabet excludes (0, O, 1, I, L) gets rejected as malformed
// long before the behaviour under test is reached, and the resulting 400 looks
// nothing like the thing that actually went wrong.
async function seedTransfer(code: string, expiresAt: string) {
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
  await env.DB.prepare('INSERT INTO transfers (code, payload, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(code, '{"a":1}', '2020-01-01T00:00:00.000Z', expiresAt)
    .run()
}

describe('POST /transfer', () => {
  it('returns a six character code and when it expires', async () => {
    const response = await create({ payload: '{"order20-best-score":"18"}' })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { code: string; expiresAt: string }
    expect(body.code).toHaveLength(6)
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('only ever uses characters that cannot be misread', async () => {
    // No 0/O, no 1/I/L. Someone reads this aloud or copies it by eye.
    for (let i = 0; i < 40; i++) {
      const code = await mintCode()
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
    }
  })

  it('does not hand out the same code twice', async () => {
    const codes = new Set<string>()
    for (let i = 0; i < 30; i++) codes.add(await mintCode())
    expect(codes.size).toBe(30)
  })

  it('rejects a missing or empty payload', async () => {
    expect((await create({})).status).toBe(400)
    expect((await create({ payload: '' })).status).toBe(400)
    expect((await create({ payload: 42 })).status).toBe(400)
  })

  it('refuses a payload far larger than a saved game', async () => {
    expect((await create({ payload: 'x'.repeat(256 * 1024 + 1) })).status).toBe(400)
  })

  it('sweeps expired rows when a new code is minted', async () => {
    await seedTransfer('ZZZ999', '2020-01-01T00:15:00.000Z')

    await mintCode()

    const stale = await env.DB.prepare('SELECT code FROM transfers WHERE code = ?1').bind('ZZZ999').first()
    expect(stale).toBeNull()
  })
})

describe('POST /transfer/claim', () => {
  it('hands the payload to the device that has the code', async () => {
    const payload = JSON.stringify({ 'order20-best-score': '18', 'order20-leaderboard-name': 'JRC' })
    const code = await mintCode(payload)

    const response = await claim({ code })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { payload: string }).payload).toBe(payload)
  })

  it('accepts the code as a person would actually type it', async () => {
    const code = await mintCode()

    const response = await claim({ code: `  ${code.toLowerCase()}  ` })
    expect(response.status).toBe(200)
  })

  it('works exactly once', async () => {
    const code = await mintCode()

    expect((await claim({ code })).status).toBe(200)

    const second = await claim({ code })
    expect(second.status).toBe(404)
    expect(((await second.json()) as { error: string }).error).toMatch(/expired or has already been used/)
  })

  it('refuses an expired code', async () => {
    await seedTransfer('EXPRED', '2020-01-01T00:15:00.000Z')

    expect((await claim({ code: 'EXPRED' })).status).toBe(404)
  })

  it('gives the same answer for an unknown code as for a used one', async () => {
    // Distinguishing them would tell a guesser which codes exist.
    const used = await mintCode()
    await claim({ code: used })

    const unknownBody = (await (await claim({ code: 'ZZZZZZ' })).json()) as { error: string }
    const usedBody = (await (await claim({ code: used })).json()) as { error: string }
    expect(unknownBody.error).toBe(usedBody.error)
  })

  it('rejects anything that is not a well-formed code', async () => {
    expect((await claim({ code: 'ABC' })).status).toBe(400)
    expect((await claim({ code: 'ABCDEFG' })).status).toBe(400)
    // 0, O, 1 and I are deliberately not in the alphabet.
    expect((await claim({ code: 'ABC0DE' })).status).toBe(400)
    expect((await claim({ code: 'ABC1DE' })).status).toBe(400)
    expect((await claim({ code: 'ABC-DE' })).status).toBe(400)
    expect((await claim({})).status).toBe(400)
  })

  it('lets only one of two devices racing the same code win', async () => {
    const code = await mintCode()

    const [a, b] = await Promise.all([claim({ code }), claim({ code })])
    const statuses = [a.status, b.status].sort()

    expect(statuses).toEqual([200, 404])
  })
})

describe('GET /transfer/status', () => {
  it('reports not claimed until someone collects it', async () => {
    const code = await mintCode()

    const before = (await (await status(code)).json()) as { claimed: boolean }
    expect(before.claimed).toBe(false)

    await claim({ code })

    const after = (await (await status(code)).json()) as { claimed: boolean }
    expect(after.claimed).toBe(true)
  })

  it('reports not claimed for a code that never existed, without erroring', async () => {
    const body = (await (await status('ZZZZZZ')).json()) as { claimed: boolean }
    expect(body.claimed).toBe(false)
  })

  it('rejects a malformed code', async () => {
    expect((await status('nope')).status).toBe(400)
    expect((await SELF.fetch('http://example.com/transfer/status')).status).toBe(400)
  })

  it('never returns the payload', async () => {
    const code = await mintCode('{"secret":"do not leak"}')
    const raw = await (await status(code)).text()
    expect(raw).not.toContain('do not leak')
  })
})
