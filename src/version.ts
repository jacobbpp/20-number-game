// Bumped by hand alongside package.json's version whenever a user-facing
// change ships — this is the single source of truth the What's New popup
// (useWhatsNew) compares against localStorage to decide what's unseen.
//
// Semver discipline: PATCH for fixes and small polish (not changelog-worthy
// on their own), MINOR for a genuinely new capability (gets a changelog
// entry), MAJOR reserved for a real relaunch.
export const APP_VERSION = '1.24.0'

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
