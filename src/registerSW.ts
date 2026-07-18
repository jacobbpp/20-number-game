import { registerSW } from 'virtual:pwa-register'

// A tab left open across a deploy won't notice a new service worker on its
// own — the browser only checks for one on a fresh navigation. This polls
// for updates while the tab is open (and whenever it regains focus) and
// reloads automatically the moment a new version takes over, so an already
// open tab picks up a deploy without the player doing anything.
const CHECK_INTERVAL_MS = 60 * 1000

export function setupAutoUpdate() {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      const checkForUpdate = async () => {
        if (registration.installing || !navigator.onLine) return
        try {
          const response = await fetch(swUrl, { cache: 'no-store' })
          if (response.status === 200) await registration.update()
        } catch {
          // Offline or a network hiccup — the next scheduled check retries.
        }
      }

      setInterval(checkForUpdate, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
    },
    onNeedRefresh() {
      updateSW(true)
    },
  })
}
