// GitHub Pages serves sw.js with a 10-minute Cache-Control (out of our
// control — Pages doesn't allow custom response headers). A registration
// created the ordinary way is still subject to that header on every
// `update()` check, so it can silently re-fetch the same stale cached
// sw.js for up to 10 minutes and never notice a deploy at all — which is
// exactly why a plain refresh wasn't picking up new versions. Registering
// with `updateViaCache: 'none'` makes every update() check bypass the
// browser's HTTP cache for the worker script, regardless of that header.
//
// virtual:pwa-register's registerSW() doesn't expose updateViaCache (it
// hardcodes `new Workbox(url, { scope, type })` with no passthrough), so
// this registers and drives the update lifecycle directly instead.
const CHECK_INTERVAL_MS = 60 * 1000
const SW_URL = `${import.meta.env.BASE_URL}sw.js`

export function setupAutoUpdate() {
  // No service worker is built in dev mode (devOptions isn't enabled), so
  // registering here would just fail against a route that doesn't exist.
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.register(SW_URL, { updateViaCache: 'none' }).then(registration => {
    // A worker can already be sitting in "waiting" if it finished
    // installing in a background tab before this tab registered.
    if (registration.waiting && navigator.serviceWorker.controller) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return

      installing.addEventListener('statechange', () => {
        // No existing controller means this is the very first install,
        // which has nothing to hand off from and activates on its own —
        // only a genuine update (something already controlling the page)
        // needs telling to skip the wait.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          installing.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    })

    const checkForUpdate = () => {
      if (registration.installing || !navigator.onLine) return
      registration.update().catch(() => {
        // Offline or a network hiccup — the next scheduled check retries.
      })
    }

    setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
  })

  // Fires once the new worker actually takes control — reload right away
  // so the tab picks up the deploy without the player doing anything.
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}
