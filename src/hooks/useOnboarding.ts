import { useCallback, useState } from 'react'

export const ONBOARDING_STORAGE_KEY = 'order20-onboarded'

function readHasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    // Storage unavailable — default to not forcing onboarding on every load.
    return true
  }
}

export function useOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(readHasSeenOnboarding)

  const markSeen = useCallback(() => {
    setHasSeenOnboarding(true)
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    } catch {
      // Storage unavailable — the flag just won't persist across reloads.
    }
  }, [])

  return { hasSeenOnboarding, markSeen }
}
