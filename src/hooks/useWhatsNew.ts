import { useEffect, useState } from 'react'
import { CHANGELOG } from '../changelog'
import { APP_VERSION, compareVersions } from '../version'

const SEEN_VERSION_STORAGE_KEY = 'order20-whatsnew-seen-version'

function readSeenVersion(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SEEN_VERSION_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeSeenVersion(version: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SEEN_VERSION_STORAGE_KEY, version)
  } catch {
    // Storage unavailable — the popup may reappear next visit, which is a
    // harmless annoyance rather than a real failure.
  }
}

// hasSeenOnboarding distinguishes "returning player who's missed some
// updates" (show them everything since their last visit) from "brand new
// player who's never played any version" (nothing to catch up on — mark
// them current silently instead of dumping the whole changelog on their
// first launch).
export function useWhatsNew(hasSeenOnboarding: boolean) {
  const [seenVersion, setSeenVersion] = useState<string | null>(readSeenVersion)

  useEffect(() => {
    if (!hasSeenOnboarding && seenVersion === null) {
      writeSeenVersion(APP_VERSION)
      setSeenVersion(APP_VERSION)
    }
  }, [hasSeenOnboarding, seenVersion])

  const unseenEntries = hasSeenOnboarding
    ? seenVersion === null
      ? CHANGELOG
      : CHANGELOG.filter(entry => compareVersions(entry.version, seenVersion) > 0)
    : []

  const isOpen = unseenEntries.length > 0

  const close = () => {
    writeSeenVersion(APP_VERSION)
    setSeenVersion(APP_VERSION)
  }

  return { isOpen, unseenEntries, close }
}
