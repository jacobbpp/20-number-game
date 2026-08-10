import { env, SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { allowWrite } from '../src/index'

const LIMIT = 60
const WINDOW_MS = 60_000
const T0 = 1_800_000_000_000

// Drives the object directly so the window can be moved without waiting a
// real minute.
function limiterFor(key: string) {
  return env.RATE_LIMITER.getByName(key)
}

function writeRequest(ip = '203.0.113.10') {
  return new Request('http://example.com/games', { method: 'POST', headers: { 'CF-Connecting-IP': ip } })
}

describe('the counter itself', () => {
  it('allows everything up to the limit and refuses the next one', async () => {
    const limiter = limiterFor('counter-basic')

    for (let i = 1; i <= LIMIT; i++) {
      expect(await limiter.consume(T0)).toBe(true)
    }
    expect(await limiter.consume(T0)).toBe(false)
  })

  it('keeps refusing for the rest of the window', async () => {
    const limiter = limiterFor('counter-stays-shut')
    for (let i = 0; i <= LIMIT; i++) await limiter.consume(T0)

    expect(await limiter.consume(T0 + WINDOW_MS - 1)).toBe(false)
  })

  it('starts fresh once the window has passed', async () => {
    const limiter = limiterFor('counter-resets')
    for (let i = 0; i <= LIMIT; i++) await limiter.consume(T0)
    expect(await limiter.consume(T0)).toBe(false)

    expect(await limiter.consume(T0 + WINDOW_MS)).toBe(true)
  })

  it('leaves room for a real player, whose peak is about twenty writes a minute', async () => {
    const limiter = limiterFor('counter-real-play')

    // Five games in a minute, the busiest minute in the whole log, at four
    // writes each.
    for (let i = 0; i < 20; i++) {
      expect(await limiter.consume(T0 + i * 500)).toBe(true)
    }
  })
})

describe('who gets counted together', () => {
  it('counts each key separately, so one person cannot use up another\'s', async () => {
    const busy = limiterFor('device:busy-one')
    for (let i = 0; i <= LIMIT; i++) await busy.consume(T0)
    expect(await busy.consume(T0)).toBe(false)

    // Somebody else on the same sofa is untouched.
    expect(await limiterFor('device:quiet-one').consume(T0)).toBe(true)
  })

  it('keys on the device when there is one', async () => {
    const request = writeRequest()

    for (let i = 0; i < LIMIT; i++) {
      expect(await allowWrite(request, env, 'device-aaa')).toBe(true)
    }
    expect(await allowWrite(request, env, 'device-aaa')).toBe(false)
    // Same address, different person: unaffected. This is the whole reason
    // for keying on the device rather than the address.
    expect(await allowWrite(request, env, 'device-bbb')).toBe(true)
  })

  it('falls back to the address only when there is no device', async () => {
    const request = writeRequest('198.51.100.42')

    for (let i = 0; i < LIMIT; i++) {
      expect(await allowWrite(request, env)).toBe(true)
    }
    expect(await allowWrite(request, env)).toBe(false)
    // A different address is its own bucket.
    expect(await allowWrite(writeRequest('198.51.100.43'), env)).toBe(true)
  })

  it('never lets an address bucket collide with a device of the same name', async () => {
    const request = writeRequest('collide')

    for (let i = 0; i < LIMIT; i++) await allowWrite(request, env)
    expect(await allowWrite(request, env)).toBe(false)
    // Prefixed keys keep these apart even when the strings match.
    expect(await allowWrite(request, env, 'collide')).toBe(true)
  })
})

describe('when the limiter is unhappy', () => {
  it('lets the write through rather than failing it', async () => {
    const broken = {
      ...env,
      RATE_LIMITER: {
        getByName() {
          throw new Error('limiter unavailable')
        },
      },
    } as unknown as Parameters<typeof allowWrite>[1]

    // A limiter problem must never take writes down with it.
    expect(await allowWrite(writeRequest(), broken, 'device-aaa')).toBe(true)
  })
})

describe('through the real endpoints', () => {
  it('refuses a write once that device has had its allowance', async () => {
    const deviceId = 'flood-device-aaa'
    const body = { deviceId, name: 'FLOOD', date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount: 5 }

    const post = () =>
      SELF.fetch('http://example.com/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    const codes: number[] = []
    for (let i = 0; i < LIMIT + 5; i++) codes.push((await post()).status)

    expect(codes.filter(code => code === 204)).toHaveLength(LIMIT)
    expect(codes.filter(code => code === 429)).toHaveLength(5)
  })

  it('leaves reads alone, so nothing gets slower or cut off', async () => {
    // Only writes are gated: a poll should never be refused.
    for (let i = 0; i < LIMIT + 10; i++) {
      expect((await SELF.fetch('http://example.com/activity')).status).toBe(200)
    }
  })
})
