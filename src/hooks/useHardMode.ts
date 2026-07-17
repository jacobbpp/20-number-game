import { useCallback, useState } from 'react'

const STORAGE_KEY = 'order20-hard-mode'

function readStoredHardMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStoredHardMode(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable — the choice just won't persist across reloads.
  }
}

export function useHardMode() {
  const [hardMode, setHardMode] = useState(readStoredHardMode)

  const toggleHardMode = useCallback(() => {
    setHardMode(prev => {
      const next = !prev
      writeStoredHardMode(next)
      return next
    })
  }, [])

  return { hardMode, toggleHardMode }
}
