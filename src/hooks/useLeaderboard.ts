import { useCallback, useState } from 'react'
import { API_BASE } from '../api'
import type { LeaderboardActivityEntry, LeaderboardWindow } from '../game/leaderboardActivity'

export type { LeaderboardWindow }

export interface LeaderboardEntry {
  name: string
  score: number
}

const NAME_KEY = 'order20-leaderboard-name'
const ACTIVITY_KEY = 'order20-leaderboard-activity'
// Comfortably more than a day's realistic play volume, while keeping the
// stored history from growing without bound over months of use.
const ACTIVITY_LIMIT = 200

interface CheckResponse {
  windows?: string[]
}

interface LeaderboardResponse {
  entries?: LeaderboardEntry[]
}

function isActivityEntry(value: unknown): value is LeaderboardActivityEntry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LeaderboardActivityEntry>
  return typeof candidate.date === 'string' && Array.isArray(candidate.windows)
}

function readActivity(): LeaderboardActivityEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isActivityEntry)
  } catch {
    return []
  }
}

// Backs the arcade-style "enter your name" prompt: which window(s) a score
// currently qualifies for, submitting a qualifying score, and the name
// itself, remembered across games so it's not retyped every time. Also
// keeps a local log of every completed game's qualifying result, so
// Insights can say how many of today's games made a board without needing
// any new server-side tracking.
export function useLeaderboard() {
  const [name, setName] = useState<string>(() => localStorage.getItem(NAME_KEY) ?? '')
  const [activityLog, setActivityLog] = useState<LeaderboardActivityEntry[]>(readActivity)

  const checkQualifies = useCallback(async (boardSize: number, score: number): Promise<LeaderboardWindow[]> => {
    try {
      const response = await fetch(`${API_BASE}/scores/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize, score }),
      })
      if (!response.ok) return []
      const data = (await response.json()) as CheckResponse
      return Array.isArray(data.windows) ? (data.windows as LeaderboardWindow[]) : []
    } catch {
      return []
    }
  }, [])

  const submitScore = useCallback((boardSize: number, playerName: string, score: number) => {
    localStorage.setItem(NAME_KEY, playerName)
    setName(playerName)
    fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardSize, name: playerName, score }),
    }).catch(() => {
      // Best-effort — a failed submission never blocks starting a new game.
    })
  }, [])

  const fetchLeaderboard = useCallback(async (boardSize: number, window: LeaderboardWindow): Promise<LeaderboardEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/scores/leaderboard?boardSize=${boardSize}&window=${window}`)
      if (!response.ok) return []
      const data = (await response.json()) as LeaderboardResponse
      return Array.isArray(data.entries) ? data.entries : []
    } catch {
      return []
    }
  }, [])

  const logActivity = useCallback((date: string, windows: LeaderboardWindow[]) => {
    setActivityLog(prev => {
      const next = [...prev, { date, windows }].slice(-ACTIVITY_LIMIT)
      try {
        window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable — the log just won't persist across reloads.
      }
      return next
    })
  }, [])

  return { name, activityLog, checkQualifies, submitScore, fetchLeaderboard, logActivity }
}
