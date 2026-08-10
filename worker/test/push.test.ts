import { env, SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDailyReminders } from '../src/index'
import { isSubscriptionGone, vapidAuthorization } from '../src/push'

const KEYS = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
const T0 = Date.parse('2026-08-10T08:00:00.000Z')
const TODAY = '2026-08-10'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM push_subscriptions').run()
  await env.DB.prepare('DELETE FROM game_log').run()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function fromBase64url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(fromBase64url(segment)))
}

async function subscribe(endpoint: string, deviceId: string | null = null) {
  await env.DB.prepare(
    'INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  )
    .bind(endpoint, 'p256dh-value', 'auth-value', deviceId, '2026-08-01T00:00:00.000Z')
    .run()
}

async function logGame(deviceId: string, mode: string, date = TODAY) {
  await env.DB.prepare(
    'INSERT INTO game_log (device_id, name, date, mode, board_size, placed_count, created_at) VALUES (?1, ?2, ?3, ?4, 20, 12, ?5)',
  )
    .bind(deviceId, 'TEST', date, mode, `${date}T07:00:00.000Z`)
    .run()
}

// Stands in for the browser's push service. Returns the calls it received so
// a test can look at what was actually sent, not just at the tally.
function stubPushService(statusFor: (endpoint: string) => number = () => 201) {
  const calls: { endpoint: string; headers: Headers }[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    calls.push({ endpoint, headers: new Headers(init?.headers) })
    return new Response(null, { status: statusFor(endpoint) })
  })
  return calls
}

describe('the VAPID token', () => {
  it('is signed by the key the browser subscribed with', async () => {
    const header = await vapidAuthorization(ENDPOINT, KEYS, T0)
    const token = /t=([^,]+)/.exec(header)?.[1] ?? ''
    const [protectedHeader, claims, signature] = token.split('.')

    const publicKey = await crypto.subtle.importKey(
      'raw',
      fromBase64url(env.VAPID_PUBLIC_KEY),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64url(signature),
      new TextEncoder().encode(`${protectedHeader}.${claims}`),
    )

    expect(verified).toBe(true)
  })

  it('carries the public key alongside it, so the service can check the signature', async () => {
    const header = await vapidAuthorization(ENDPOINT, KEYS, T0)

    expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/)
    expect(header.endsWith(`k=${env.VAPID_PUBLIC_KEY}`)).toBe(true)
  })

  it('says ES256, which is the only algorithm push services accept', async () => {
    const header = await vapidAuthorization(ENDPOINT, KEYS, T0)
    const token = /t=([^,]+)/.exec(header)?.[1] ?? ''

    expect(decodeSegment(token.split('.')[0])).toEqual({ typ: 'JWT', alg: 'ES256' })
  })

  it('is addressed to one push service, so it cannot be replayed against another', async () => {
    const mozilla = await vapidAuthorization('https://updates.push.services.mozilla.com/wpush/v2/xyz', KEYS, T0)
    const google = await vapidAuthorization(ENDPOINT, KEYS, T0)

    const audienceOf = (header: string) => decodeSegment((/t=([^,]+)/.exec(header)?.[1] ?? '').split('.')[1]).aud

    expect(audienceOf(mozilla)).toBe('https://updates.push.services.mozilla.com')
    expect(audienceOf(google)).toBe('https://fcm.googleapis.com')
  })

  it('expires inside the 24 hours the spec allows', async () => {
    const header = await vapidAuthorization(ENDPOINT, KEYS, T0)
    const claims = decodeSegment((/t=([^,]+)/.exec(header)?.[1] ?? '').split('.')[1])

    const secondsAhead = (claims.exp as number) - Math.floor(T0 / 1000)
    expect(secondsAhead).toBeGreaterThan(0)
    expect(secondsAhead).toBeLessThan(24 * 60 * 60)
  })

  it('refuses a public key that is not a P-256 point', async () => {
    await expect(vapidAuthorization(ENDPOINT, { publicKey: 'aGVsbG8', privateKey: KEYS.privateKey }, T0)).rejects.toThrow(
      /P-256/,
    )
  })
})

describe('which failures mean a subscription is finished', () => {
  it('treats gone as gone and everything else as worth retrying', () => {
    expect(isSubscriptionGone(404)).toBe(true)
    expect(isSubscriptionGone(410)).toBe(true)
    // A rate limit, an outage or a network drop are all temporary.
    expect(isSubscriptionGone(429)).toBe(false)
    expect(isSubscriptionGone(500)).toBe(false)
    expect(isSubscriptionGone(0)).toBe(false)
  })
})

describe('the morning send', () => {
  it('sends one push to each subscribed browser', async () => {
    const calls = stubPushService()
    await subscribe('https://push.example.com/a', 'device-aaa-1')
    await subscribe('https://push.example.com/b', 'device-bbb-1')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.sent).toBe(2)
    expect(calls.map(call => call.endpoint).sort()).toEqual(['https://push.example.com/a', 'https://push.example.com/b'])
  })

  it('signs every send and tells the service how long to hold it', async () => {
    const calls = stubPushService()
    await subscribe('https://push.example.com/a', 'device-aaa-1')

    await sendDailyReminders(env, TODAY, T0)

    expect(calls[0].headers.get('Authorization')).toMatch(/^vapid t=/)
    expect(Number(calls[0].headers.get('TTL'))).toBeGreaterThan(0)
  })

  it('leaves alone anyone who has already done today\'s challenge', async () => {
    const calls = stubPushService()
    await subscribe('https://push.example.com/early', 'device-early-1')
    await subscribe('https://push.example.com/late', 'device-late-11')
    await logGame('device-early-1', 'daily')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.skipped).toBe(1)
    expect(run.sent).toBe(1)
    expect(calls.map(call => call.endpoint)).toEqual(['https://push.example.com/late'])
  })

  it('still tells someone who has only played free play', async () => {
    // Free play is not the daily. Somebody can play a dozen free games and
    // never touch the thing this notification is about.
    const calls = stubPushService()
    await subscribe('https://push.example.com/freeplay', 'device-free-11')
    await logGame('device-free-11', 'freeplay')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.sent).toBe(1)
    expect(calls).toHaveLength(1)
  })

  it('still tells someone whose only daily was yesterday', async () => {
    stubPushService()
    await subscribe('https://push.example.com/yesterday', 'device-yest-11')
    await logGame('device-yest-11', 'daily', '2026-08-09')

    expect((await sendDailyReminders(env, TODAY, T0)).sent).toBe(1)
  })

  it('forgets a subscription the push service says is gone', async () => {
    stubPushService(endpoint => (endpoint.endsWith('/dead') ? 410 : 201))
    await subscribe('https://push.example.com/dead', 'device-dead-11')
    await subscribe('https://push.example.com/alive', 'device-live-11')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.removed).toBe(1)
    expect(run.sent).toBe(1)

    const left = await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all<{ endpoint: string }>()
    expect(left.results.map(row => row.endpoint)).toEqual(['https://push.example.com/alive'])
  })

  it('keeps a subscription that failed for some other reason', async () => {
    // An outage at the push service must not quietly unsubscribe everyone.
    stubPushService(() => 500)
    await subscribe('https://push.example.com/a', 'device-aaa-1')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.failed).toBe(1)
    expect(run.removed).toBe(0)

    const left = await env.DB.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first<{ count: number }>()
    expect(left?.count).toBe(1)
  })

  it('survives the push service being unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network down')
    })
    await subscribe('https://push.example.com/a', 'device-aaa-1')

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.failed).toBe(1)
    expect(run.removed).toBe(0)
  })

  it('records when it last reached each browser, and only for the ones it reached', async () => {
    stubPushService(endpoint => (endpoint.endsWith('/broken') ? 500 : 201))
    await subscribe('https://push.example.com/ok', 'device-okk-11')
    await subscribe('https://push.example.com/broken', 'device-brk-11')

    await sendDailyReminders(env, TODAY, T0)

    const rows = await env.DB.prepare('SELECT endpoint, last_sent_at FROM push_subscriptions ORDER BY endpoint')
      .all<{ endpoint: string; last_sent_at: string | null }>()

    expect(rows.results.find(row => row.endpoint.endsWith('/broken'))?.last_sent_at).toBeNull()
    expect(rows.results.find(row => row.endpoint.endsWith('/ok'))?.last_sent_at).toBe(new Date(T0).toISOString())
  })

  it('does nothing at all when nobody has turned it on', async () => {
    const calls = stubPushService()

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run).toEqual({ sent: 0, skipped: 0, removed: 0, failed: 0, deferred: 0 })
    expect(calls).toHaveLength(0)
  })

  it('counts what it could not fit in one run rather than dropping it silently', async () => {
    // One send is one subrequest and the plan allows fifty per invocation. If
    // that ceiling is ever reached, the number left over has to show up
    // somewhere: a truncated run that reports success looks identical to one
    // that reached everybody.
    const calls = stubPushService()
    for (let i = 0; i < 45; i++) await subscribe(`https://push.example.com/${i}`)

    const run = await sendDailyReminders(env, TODAY, T0)

    expect(run.sent + run.deferred).toBe(45)
    expect(run.deferred).toBeGreaterThan(0)
    expect(calls).toHaveLength(run.sent)
  })
})

describe('POST /push/subscribe', () => {
  function post(body: unknown, ip = '203.0.113.90') {
    return SELF.fetch('http://example.com/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify(body),
    })
  }

  const valid = { endpoint: ENDPOINT, p256dh: 'p256dh-value', auth: 'auth-value', deviceId: 'device-aaa-1' }

  it('stores the subscription', async () => {
    expect((await post(valid)).status).toBe(204)

    const row = await env.DB.prepare('SELECT endpoint, device_id FROM push_subscriptions').first<{
      endpoint: string
      device_id: string
    }>()
    expect(row?.endpoint).toBe(ENDPOINT)
    expect(row?.device_id).toBe('device-aaa-1')
  })

  it('replaces rather than duplicates when the same browser subscribes again', async () => {
    // Otherwise turning the reminder off and on would send two notifications
    // every morning, then three.
    await post(valid)
    await post({ ...valid, deviceId: 'device-bbb-2' })

    const rows = await env.DB.prepare('SELECT device_id FROM push_subscriptions').all<{ device_id: string }>()
    expect(rows.results).toHaveLength(1)
    expect(rows.results[0].device_id).toBe('device-bbb-2')
  })

  it('accepts a subscription with no device id', async () => {
    expect((await post({ ...valid, deviceId: undefined })).status).toBe(204)
  })

  it('refuses anything that is not a https endpoint', async () => {
    expect((await post({ ...valid, endpoint: 'http://push.example.com/a' })).status).toBe(400)
    expect((await post({ ...valid, endpoint: 'not a url' })).status).toBe(400)
    expect((await post({ ...valid, endpoint: '' })).status).toBe(400)
    expect((await post({ ...valid, endpoint: 42 })).status).toBe(400)
  })

  it('refuses a subscription missing its keys', async () => {
    expect((await post({ ...valid, p256dh: undefined })).status).toBe(400)
    expect((await post({ ...valid, auth: '' })).status).toBe(400)
  })

  it('refuses a malformed device id', async () => {
    expect((await post({ ...valid, deviceId: 'short' })).status).toBe(400)
  })

  it('refuses a body that is not JSON', async () => {
    const response = await SELF.fetch('http://example.com/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(response.status).toBe(400)
  })

  it('stores nothing when the body is rejected', async () => {
    await post({ ...valid, endpoint: 'http://push.example.com/a' })

    const row = await env.DB.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first<{ count: number }>()
    expect(row?.count).toBe(0)
  })
})

describe('POST /push/unsubscribe', () => {
  function post(body: unknown, ip = '203.0.113.91') {
    return SELF.fetch('http://example.com/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify(body),
    })
  }

  it('removes the subscription', async () => {
    await subscribe(ENDPOINT, 'device-aaa-1')

    expect((await post({ endpoint: ENDPOINT })).status).toBe(204)

    const row = await env.DB.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first<{ count: number }>()
    expect(row?.count).toBe(0)
  })

  it('succeeds for an endpoint that was never stored', async () => {
    // Turning off something already off has got what it wanted. Reporting an
    // error would leave the app showing a failure for the desired state.
    expect((await post({ endpoint: 'https://push.example.com/never' })).status).toBe(204)
  })

  it('leaves everyone else subscribed', async () => {
    await subscribe('https://push.example.com/mine', 'device-aaa-1')
    await subscribe('https://push.example.com/theirs', 'device-bbb-2')

    await post({ endpoint: 'https://push.example.com/mine' })

    const rows = await env.DB.prepare('SELECT endpoint FROM push_subscriptions').all<{ endpoint: string }>()
    expect(rows.results.map(row => row.endpoint)).toEqual(['https://push.example.com/theirs'])
  })

  it('refuses a malformed endpoint', async () => {
    expect((await post({ endpoint: 'nonsense' })).status).toBe(400)
    expect((await post({})).status).toBe(400)
  })
})
