import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import {
  VAPID_PUBLIC_KEY,
  decodeVapidKey,
  describeEnvironment,
  encodeSubscriptionKey,
  readAvailability,
  type PushAvailability,
} from '../game/push'
import { getOrCreateDeviceId } from './useLeaderboard'

export interface PushReminder {
  availability: PushAvailability
  enabled: boolean
  busy: boolean
  error: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
}

// navigator.serviceWorker.ready resolves when a worker is controlling the
// page, and otherwise waits forever without ever rejecting. That happens on a
// first visit before the install finishes, and always in dev where no worker
// is built at all. Racing it means the button reports a problem instead of
// spinning for good.
const READY_TIMEOUT_MS = 5000

function readyRegistration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('no service worker')), READY_TIMEOUT_MS)
    }),
  ])
}

export function usePushReminder(): PushReminder {
  const [availability, setAvailability] = useState<PushAvailability>('unsupported')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const environment = describeEnvironment()
    setAvailability(readAvailability(environment))

    if (!environment.hasServiceWorker || !environment.hasPushManager) return

    // Whether this is actually on is the browser's business, not something to
    // keep a flag about: permission can be taken away in system settings at
    // any time, and a stored flag would carry on insisting it was on.
    readyRegistration()
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => {
        if (!cancelled) setEnabled(subscription !== null)
      })
      .catch(() => {
        // Nothing registered yet. Reads as off, which it is.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    setError(null)

    try {
      // First thing, before anything is awaited. Browsers only allow a
      // permission prompt raised directly by a tap, and awaiting first breaks
      // the chain back to that tap.
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        // "denied" is final and only the browser's own settings can undo it.
        // "default" means the prompt was dismissed, which can be asked again.
        setAvailability(permission === 'denied' ? 'blocked' : 'available')
        return
      }

      const registration = await readyRegistration()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(VAPID_PUBLIC_KEY),
      })

      const response = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: encodeSubscriptionKey(subscription.getKey('p256dh')),
          auth: encodeSubscriptionKey(subscription.getKey('auth')),
          deviceId: getOrCreateDeviceId(),
        }),
      })

      if (!response.ok) {
        // The browser is now holding a subscription nothing will ever send
        // to. Undo it, so the switch and the truth agree.
        await subscription.unsubscribe().catch(() => {})
        throw new Error('could not save the subscription')
      }

      setEnabled(true)
      setAvailability('available')
    } catch {
      setError('Could not turn the reminder on. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)

    try {
      const registration = await readyRegistration()
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Told first so the row goes even if the browser end then fails. If
        // this call is the one that fails, tomorrow's send gets a 410 for a
        // subscription that no longer exists and drops the row itself.
        await fetch(`${API_BASE}/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {})

        await subscription.unsubscribe()
      }

      setEnabled(false)
    } catch {
      setError('Could not turn the reminder off. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [])

  return { availability, enabled, busy, error, enable, disable }
}
