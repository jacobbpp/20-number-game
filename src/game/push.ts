// Everything about push notifications that can be decided without touching a
// live browser, kept out of the hook so the awkward cases can be tested
// directly rather than by simulating four different phones.

// The public half of the worker's VAPID pair. This must stay identical to
// VAPID_PUBLIC_KEY in worker/wrangler.toml: the browser hands it to its push
// service when subscribing, and the service then rejects any message not
// signed by the matching private key. Public by design, and safe to ship.
export const VAPID_PUBLIC_KEY = 'BPUHR96Z7cvcUYgYY5LnJgrLijZFH5fp9CRBHysc1kMgY2hS6wzTyJTXFqQSOJK_J0RdR-1DjvDi85a4V_YIeVY'

export type PushAvailability =
  // Can be turned on right now.
  | 'available'
  // An iPhone or iPad, where the app has to be on the Home Screen first.
  | 'needs-install'
  // Notifications were refused, and only the browser's own settings can
  // undo that. Asking again does nothing.
  | 'blocked'
  // This browser cannot do it at all.
  | 'unsupported'

export interface PushEnvironment {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  permission: NotificationPermission | null
  isIos: boolean
  isStandalone: boolean
}

export function readAvailability(environment: PushEnvironment): PushAvailability {
  if (!environment.hasServiceWorker) return 'unsupported'

  // Checked before the capability check, deliberately. iOS only exposes the
  // Push API to apps launched from the Home Screen, so in Safari proper the
  // interfaces are simply absent — which would otherwise be reported as
  // "your browser cannot do this" when the truth is "not yet".
  if (environment.isIos && !environment.isStandalone) return 'needs-install'

  if (!environment.hasPushManager || !environment.hasNotification) return 'unsupported'
  if (environment.permission === 'denied') return 'blocked'

  return 'available'
}

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // An iPad running iPadOS reports itself as a Mac and is otherwise
  // indistinguishable. The touch points give it away: no actual Mac has more
  // than one.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function isStandalone(): boolean {
  // navigator.standalone is the iOS-only original and is still the only
  // reliable signal there; display-mode covers everyone else.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (iosStandalone) return true

  // Guarded because this runs while the app is mounting, and every browser
  // that lacks matchMedia also lacks push. Reading it unguarded would take
  // the whole game down to answer a question that has no bearing on playing.
  if (typeof window.matchMedia !== 'function') return false

  return window.matchMedia('(display-mode: standalone)').matches
}

export function describeEnvironment(): PushEnvironment {
  const hasNotification = typeof window !== 'undefined' && 'Notification' in window

  return {
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
    isIos: typeof navigator !== 'undefined' && isIos(navigator.userAgent, navigator.maxTouchPoints),
    isStandalone: typeof window !== 'undefined' && isStandalone(),
  }
}

// pushManager.subscribe wants the key as raw bytes, but it travels as
// base64url, which is base64 with two characters swapped and the padding
// dropped. Both have to be put back.
// Uint8Array<ArrayBuffer> rather than a bare Uint8Array: applicationServerKey
// takes a BufferSource, and the wider Uint8Array<ArrayBufferLike> that
// Uint8Array.from infers might be backed by a SharedArrayBuffer, which is not
// one. Allocating the buffer explicitly settles it.
export function decodeVapidKey(key: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (key.length % 4)) % 4)
  const binary = atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'))

  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

// The reverse, for the two keys the subscription hands back as raw buffers
// and the worker stores as text.
export function encodeSubscriptionKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''

  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
