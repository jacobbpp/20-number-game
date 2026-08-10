import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePushReminder } from './usePushReminder'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/122.0.0.0'

interface Browser {
  userAgent?: string
  standalone?: boolean
  permission?: NotificationPermission
  grants?: NotificationPermission
  supportsPush?: boolean
  alreadySubscribed?: boolean
}

// jsdom has none of this, so the whole browser side is built by hand. Written
// as one helper taking the few things that actually vary, rather than a pile
// of stubs per test.
function installBrowser(options: Browser = {}) {
  const {
    userAgent = ANDROID,
    standalone = false,
    permission = 'default',
    grants = 'granted',
    supportsPush = true,
    alreadySubscribed = false,
  } = options

  const unsubscribe = vi.fn(() => Promise.resolve(true))
  const subscription = {
    endpoint: 'https://push.example.com/abc123',
    getKey: (name: string) => new TextEncoder().encode(`${name}-bytes`).buffer,
    unsubscribe,
  }

  const subscribe = vi.fn(() => Promise.resolve(subscription))
  const getSubscription = vi.fn(() => Promise.resolve(alreadySubscribed ? subscription : null))
  const requestPermission = vi.fn(() => Promise.resolve(grants))

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }) },
  })
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })

  if (supportsPush) {
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', Object.assign(class {}, { permission, requestPermission }))
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: standalone, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )

  const posted = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(new Response(null, { status: 204 })),
  )
  vi.stubGlobal('fetch', posted)

  return { subscribe, getSubscription, unsubscribe, requestPermission, posted, subscription }
}

function bodyOf(call: [RequestInfo | URL, (RequestInit | undefined)?]) {
  return JSON.parse(String(call[1]?.body))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(navigator, 'userAgent')
})

describe('what the hook reports on arrival', () => {
  it('reports available on a browser that can do it', async () => {
    installBrowser()

    const { result } = renderHook(() => usePushReminder())

    await waitFor(() => expect(result.current.availability).toBe('available'))
    expect(result.current.enabled).toBe(false)
  })

  it('reports needs-install on an iPhone in Safari', async () => {
    installBrowser({ userAgent: IPHONE, standalone: false })

    const { result } = renderHook(() => usePushReminder())

    await waitFor(() => expect(result.current.availability).toBe('needs-install'))
  })

  it('reports available on the same iPhone once installed', async () => {
    installBrowser({ userAgent: IPHONE, standalone: true })

    const { result } = renderHook(() => usePushReminder())

    await waitFor(() => expect(result.current.availability).toBe('available'))
  })

  it('asks the browser whether it is already on rather than trusting a stored flag', async () => {
    // Permission can be taken away in system settings at any time, so the
    // browser is the only thing that knows the truth.
    const browser = installBrowser({ alreadySubscribed: true, permission: 'granted' })

    const { result } = renderHook(() => usePushReminder())

    await waitFor(() => expect(result.current.enabled).toBe(true))
    expect(browser.getSubscription).toHaveBeenCalled()
  })

  it('reports blocked once notifications have been refused', async () => {
    installBrowser({ permission: 'denied' })

    const { result } = renderHook(() => usePushReminder())

    await waitFor(() => expect(result.current.availability).toBe('blocked'))
  })
})

describe('turning it on', () => {
  it('asks permission, subscribes, and tells the worker', async () => {
    const browser = installBrowser()
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.enable()
    })

    expect(browser.requestPermission).toHaveBeenCalledOnce()
    expect(browser.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.anything() }),
    )
    expect(result.current.enabled).toBe(true)
  })

  it('sends the endpoint, both keys and the device id', async () => {
    const browser = installBrowser()
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.enable()
    })

    const call = browser.posted.mock.calls.find(([input]) => String(input).includes('/push/subscribe'))
    expect(call).toBeDefined()
    const body = bodyOf(call!)
    expect(body.endpoint).toBe('https://push.example.com/abc123')
    expect(body.p256dh).toBeTruthy()
    expect(body.auth).toBeTruthy()
    expect(body.deviceId).toBe(localStorage.getItem('order20-device-id'))
  })

  it('stays off, and says so, when the prompt is dismissed', async () => {
    installBrowser({ grants: 'default' })
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.enable()
    })

    // Dismissed rather than refused, so it can be asked again.
    expect(result.current.enabled).toBe(false)
    expect(result.current.availability).toBe('available')
  })

  it('reports blocked when the prompt is refused outright', async () => {
    installBrowser({ grants: 'denied' })
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.availability).toBe('blocked')
    expect(result.current.enabled).toBe(false)
  })

  it('undoes the subscription when the worker will not store it', async () => {
    // Otherwise the browser holds a subscription nothing will ever send to,
    // and the switch says on while no notification ever arrives.
    const browser = installBrowser()
    browser.posted.mockResolvedValue(new Response(null, { status: 500 }))

    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.enable()
    })

    expect(browser.unsubscribe).toHaveBeenCalledOnce()
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toMatch(/Could not turn the reminder on/)
  })

  it('reports a problem rather than hanging when there is no service worker', async () => {
    const browser = installBrowser()
    // Never resolves, which is exactly what serviceWorker.ready does before
    // the first install finishes.
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: new Promise(() => {}) } })
    vi.useFakeTimers()

    const { result } = renderHook(() => usePushReminder())

    const enabling = act(async () => {
      const pending = result.current.enable()
      await vi.advanceTimersByTimeAsync(6000)
      await pending
    })
    await enabling
    vi.useRealTimers()

    expect(result.current.error).toMatch(/Could not turn the reminder on/)
    expect(browser.subscribe).not.toHaveBeenCalled()
  })
})

describe('turning it off', () => {
  it('unsubscribes and tells the worker to forget the endpoint', async () => {
    const browser = installBrowser({ alreadySubscribed: true, permission: 'granted' })
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    await act(async () => {
      await result.current.disable()
    })

    expect(browser.unsubscribe).toHaveBeenCalledOnce()
    const call = browser.posted.mock.calls.find(([input]) => String(input).includes('/push/unsubscribe'))
    expect(call).toBeDefined()
    expect(bodyOf(call!).endpoint).toBe('https://push.example.com/abc123')
    expect(result.current.enabled).toBe(false)
  })

  it('still turns off locally when the worker cannot be reached', async () => {
    // Tomorrow's send gets a 410 for a subscription that no longer exists and
    // drops the row itself, so the switch does not need to stay on for it.
    const browser = installBrowser({ alreadySubscribed: true, permission: 'granted' })
    browser.posted.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    await act(async () => {
      await result.current.disable()
    })

    expect(browser.unsubscribe).toHaveBeenCalledOnce()
    expect(result.current.enabled).toBe(false)
  })

  it('succeeds when there was no subscription to begin with', async () => {
    const browser = installBrowser({ alreadySubscribed: false })
    const { result } = renderHook(() => usePushReminder())
    await waitFor(() => expect(result.current.availability).toBe('available'))

    await act(async () => {
      await result.current.disable()
    })

    expect(browser.unsubscribe).not.toHaveBeenCalled()
    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
