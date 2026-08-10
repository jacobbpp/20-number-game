import { describe, expect, it } from 'vitest'
import {
  VAPID_PUBLIC_KEY,
  decodeVapidKey,
  encodeSubscriptionKey,
  isIos,
  readAvailability,
  type PushEnvironment,
} from './push'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
const IPAD_OS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0.0.0'

// A browser that can do everything. Each test changes the one thing it is
// about, so what is being varied stays obvious.
function environment(overrides: Partial<PushEnvironment> = {}): PushEnvironment {
  return {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    permission: 'default',
    isIos: false,
    isStandalone: false,
    ...overrides,
  }
}

describe('whether the reminder can be turned on', () => {
  it('says yes for a browser with everything and no answer yet', () => {
    expect(readAvailability(environment())).toBe('available')
  })

  it('says yes once permission has already been granted', () => {
    expect(readAvailability(environment({ permission: 'granted' }))).toBe('available')
  })

  it('tells an iPhone in Safari to install first', () => {
    expect(readAvailability(environment({ isIos: true, isStandalone: false }))).toBe('needs-install')
  })

  it('lets the same iPhone through once it is on the Home Screen', () => {
    expect(readAvailability(environment({ isIos: true, isStandalone: true }))).toBe('available')
  })

  it('says install rather than unsupported when iOS is hiding the interfaces', () => {
    // This is the case that matters. In Safari proper, iOS does not expose the
    // Push API at all, so a naive capability check reports "your browser
    // cannot do this" when the honest answer is "not yet".
    const safariOnIphone = environment({
      isIos: true,
      isStandalone: false,
      hasPushManager: false,
      hasNotification: false,
      permission: null,
    })

    expect(readAvailability(safariOnIphone)).toBe('needs-install')
  })

  it('reports a refusal as blocked, not as something to ask again', () => {
    expect(readAvailability(environment({ permission: 'denied' }))).toBe('blocked')
  })

  it('reports a browser with no push support as unsupported', () => {
    expect(readAvailability(environment({ hasPushManager: false }))).toBe('unsupported')
    expect(readAvailability(environment({ hasNotification: false }))).toBe('unsupported')
  })

  it('reports no service worker as unsupported whatever else is true', () => {
    expect(readAvailability(environment({ hasServiceWorker: false }))).toBe('unsupported')
    expect(readAvailability(environment({ hasServiceWorker: false, isIos: true }))).toBe('unsupported')
  })
})

describe('spotting an iPhone or iPad', () => {
  it('recognises an iPhone', () => {
    expect(isIos(IPHONE, 5)).toBe(true)
  })

  it('recognises an iPad, which claims to be a Mac', () => {
    // iPadOS reports a desktop Safari user agent and is otherwise
    // indistinguishable. The touch points give it away.
    expect(isIos(IPAD_OS, 5)).toBe(true)
  })

  it('does not mistake an actual Mac for one', () => {
    expect(isIos(MAC, 0)).toBe(false)
    // Even with a touchscreen monitor plugged in, a Mac reports one point.
    expect(isIos(MAC, 1)).toBe(false)
  })

  it('does not mistake an Android phone for one', () => {
    expect(isIos(ANDROID, 5)).toBe(false)
  })
})

describe('the signing key the browser subscribes with', () => {
  it('is a 65 byte uncompressed point, which is what subscribe expects', () => {
    const bytes = decodeVapidKey(VAPID_PUBLIC_KEY)

    expect(bytes).toHaveLength(65)
    // 0x04 marks it as uncompressed. A key that decodes to anything else is
    // rejected by the push service with an error that says nothing useful.
    expect(bytes[0]).toBe(0x04)
  })

  it('decodes base64url, which is not the same as base64', () => {
    // "-" and "_" stand in for "+" and "/", and the padding is dropped. Both
    // have to be put back or the bytes come out wrong rather than failing.
    expect(Array.from(decodeVapidKey('-_8'))).toEqual([0xfb, 0xff])
  })

  it('round trips back to the text the worker stores', () => {
    const bytes = decodeVapidKey(VAPID_PUBLIC_KEY)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

    expect(encodeSubscriptionKey(buffer as ArrayBuffer)).toBe(VAPID_PUBLIC_KEY)
  })

  it('encodes a missing key as empty rather than crashing', () => {
    // getKey returns null if the browser has no key of that name.
    expect(encodeSubscriptionKey(null)).toBe('')
  })

  it('never produces characters that would need escaping in JSON or a URL', () => {
    const encoded = encodeSubscriptionKey(new Uint8Array([251, 255, 0, 62, 63]).buffer)

    expect(encoded).not.toMatch(/[+/=]/)
  })
})
