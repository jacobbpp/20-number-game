const STORAGE_PREFIX = 'order20-'

export function clearAllData() {
  const keysToRemove: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key)
  }
  keysToRemove.forEach(key => window.localStorage.removeItem(key))
}
