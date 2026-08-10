/* Push handling for Order 20.
 *
 * This is imported into the service worker Workbox generates, rather than
 * replacing it (see workbox.importScripts in vite.config.ts). The precaching
 * and the auto-update dance in src/registerSW.ts are left exactly as they
 * were; this only adds two listeners the generated worker has no opinion on.
 *
 * Plain JavaScript in public/ on purpose. It is copied byte for byte, so
 * nothing about the build can quietly change what actually runs here, and it
 * has no imports to resolve at install time.
 */

const API_BASE = 'https://order20-community-stats.tb-dev.workers.dev'

const TITLE = "Today's challenge is ready"
const FALLBACK_BODY = 'A new board is waiting.'

// Every push that arrives must end in a visible notification, or the browser
// posts its own "this site was updated in the background" instead. So looking
// up the recap is a nicety on a short leash, never a precondition.
const RECAP_TIMEOUT_MS = 5000

// Paths are resolved against the registration scope rather than written out.
// The app is served from a subpath (/20-number-game/) and that subpath is a
// build setting, so anything hardcoded here would be a second copy of it.
function appUrl(path) {
  return new URL(path, self.registration.scope).href
}

self.addEventListener('push', event => {
  event.waitUntil(showReminder())
})

async function showReminder() {
  return self.registration.showNotification(TITLE, {
    body: await reminderBody(),
    icon: appUrl('icons/icon-192.png'),
    badge: appUrl('icons/icon-192.png'),
    // A retry replaces the morning's notification rather than stacking a
    // second one behind it.
    tag: 'order20-daily',
    renotify: true,
    data: { url: appUrl('?open=daily') },
  })
}

// The wording is decided here, on the phone, rather than being sent with the
// push. That is what lets the push itself be empty: a message with a body has
// to be encrypted separately for every single subscription. It also means the
// text reflects the standings at the moment it is read.
async function reminderBody() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const response = await fetch(`${API_BASE}/community/yesterday?today=${today}`, {
      signal: AbortSignal.timeout(RECAP_TIMEOUT_MS),
    })
    if (!response.ok) return FALLBACK_BODY

    const { summary } = await response.json()
    if (!summary || !summary.bestName || !summary.bestScore) return FALLBACK_BODY

    return `${summary.bestName} won yesterday with ${summary.bestScore}.`
  } catch {
    // Offline, slow, or the API is down. The reminder is still worth showing.
    return FALLBACK_BODY
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
  event.waitUntil(openTheDaily(url))
})

async function openTheDaily(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of windows) {
    if (!client.url.startsWith(self.registration.scope)) continue

    await client.focus()
    // Already open, and possibly mid-game. A message lets the app decide what
    // to do about that; navigating would throw away the board on screen.
    client.postMessage({ type: 'OPEN_DAILY' })
    return
  }

  await self.clients.openWindow(url || appUrl('?open=daily'))
}
