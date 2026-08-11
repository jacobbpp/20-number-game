import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import type { HeadToHead } from '../game/nemesis'

function isRecord(value: unknown): value is HeadToHead {
  if (!value || typeof value !== 'object') return false
  const { name, days, won, lost, drew } = value as Record<string, unknown>
  return (
    typeof name === 'string' &&
    typeof days === 'number' &&
    typeof won === 'number' &&
    typeof lost === 'number' &&
    typeof drew === 'number'
  )
}

// Every daily-challenge record this player has against everyone else.
//
// Nothing is fetched until a leaderboard name exists, because the record is
// keyed on that name and there is no one to compare without it. Anybody who
// has never saved a name has no head to head to show.
export function useHeadToHead(name: string): HeadToHead[] {
  const [records, setRecords] = useState<HeadToHead[]>([])

  useEffect(() => {
    if (!name) {
      setRecords([])
      return
    }

    let cancelled = false

    fetch(`${API_BASE}/community/head-to-head?name=${encodeURIComponent(name)}`)
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        const list = (body as { records?: unknown } | null)?.records
        if (!cancelled && Array.isArray(list)) setRecords(list.filter(isRecord))
      })
      .catch(() => {
        // Offline, or blocked by CORS in local development. The card simply
        // does not appear, which is the same as not having enough data yet.
      })

    return () => {
      cancelled = true
    }
  }, [name])

  return records
}
