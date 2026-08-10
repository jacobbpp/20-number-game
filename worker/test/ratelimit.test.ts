import { env, SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { withinRateLimit, type Env } from '../src/index'

function req(method = 'GET', ip = '203.0.113.10') {
  return new Request('http://example.com/activity', { method, headers: { 'CF-Connecting-IP': ip } })
}

// The binding only exists on a deployed worker, so these drive the gate
// directly with a stand-in rather than trying to exhaust a real limiter.
function envWith(limit: (options: { key: string }) => Promise<{ success: boolean }>): Env {
  return { ...(env as unknown as Env), RATE_LIMITER: { limit } }
}

describe('rate limit gate', () => {
  it('lets a request through when the limiter says yes', async () => {
    expect(await withinRateLimit(req(), envWith(async () => ({ success: true })))).toBe(true)
  })

  it('turns a request away when the limiter says no', async () => {
    expect(await withinRateLimit(req(), envWith(async () => ({ success: false })))).toBe(false)
  })

  it('keys on the calling address', async () => {
    const seen: string[] = []
    const testEnv = envWith(async ({ key }) => {
      seen.push(key)
      return { success: true }
    })

    await withinRateLimit(req('GET', '203.0.113.10'), testEnv)
    await withinRateLimit(req('GET', '198.51.100.7'), testEnv)

    expect(seen).toEqual(['203.0.113.10', '198.51.100.7'])
  })

  it('never counts a CORS preflight', async () => {
    // Every JSON POST the app makes triggers one, so counting them would halve
    // the real budget while stopping nothing: a preflight cannot write.
    let called = false
    const testEnv = envWith(async () => {
      called = true
      return { success: false }
    })

    expect(await withinRateLimit(req('OPTIONS'), testEnv)).toBe(true)
    expect(called).toBe(false)
  })

  it('lets everything through when the binding is not configured at all', async () => {
    // Local dev and the test runner have no limiter. Refusing traffic because
    // it is missing would be a much worse failure than not limiting.
    expect(await withinRateLimit(req(), { ...(env as unknown as Env), RATE_LIMITER: undefined })).toBe(true)
  })

  it('fails open when the limiter itself throws', async () => {
    const testEnv = envWith(async () => {
      throw new Error('limiter unavailable')
    })

    expect(await withinRateLimit(req(), testEnv)).toBe(true)
  })

  it('falls back to a shared key when there is no address header', async () => {
    const seen: string[] = []
    const testEnv = envWith(async ({ key }) => {
      seen.push(key)
      return { success: true }
    })

    await withinRateLimit(new Request('http://example.com/activity'), testEnv)

    expect(seen).toEqual(['unknown'])
  })

  it('leaves the real endpoints working, since no limiter is bound under test', async () => {
    expect((await SELF.fetch('http://example.com/activity')).status).toBe(200)
  })
})
