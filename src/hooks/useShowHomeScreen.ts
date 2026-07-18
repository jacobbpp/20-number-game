import { useCallback, useState } from 'react'

const STORAGE_KEY = 'order20-show-home-screen'

// Absent means "never explicitly chosen" — default to showing it, since
// that's the intended experience. A player who'd rather skip straight to
// the board can turn it off from Settings, which just changes what's
// read here on the next load.
function readStoredShowHomeScreen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

function writeStoredShowHomeScreen(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable — the choice just won't persist across reloads.
  }
}

export function useShowHomeScreen() {
  const [showHomeScreen, setShowHomeScreen] = useState(readStoredShowHomeScreen)

  const toggleShowHomeScreen = useCallback(() => {
    setShowHomeScreen(prev => {
      const next = !prev
      writeStoredShowHomeScreen(next)
      return next
    })
  }, [])

  return { showHomeScreen, toggleShowHomeScreen }
}
