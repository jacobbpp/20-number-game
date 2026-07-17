// Bumped by hand alongside package.json's version whenever a user-facing
// change ships — this is the single source of truth the What's New popup
// (useWhatsNew) compares against localStorage to decide what's unseen.
export const APP_VERSION = '1.9.0'

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
