import { useCallback, useState } from 'react'
import { API_BASE } from '../api'
import { recordGameResult, type DailyActivityLog } from '../game/dailyActivity'
import type { LeaderboardWindow } from '../game/leaderboardActivity'

export type { LeaderboardWindow }

export interface LeaderboardEntry {
  id: number
  name: string
  score: number
  board: (number | null)[] | null
  endingRoll: number | null
}

const NAME_KEY = 'order20-leaderboard-name'
const ACTIVITY_KEY = 'order20-daily-activity'
const DEVICE_ID_KEY = 'order20-device-id'

export interface StreakEntry {
  name: string
  streakCount: number
}

interface CheckResponse {
  windows?: string[]
}

interface DailyCheckResponse {
  qualifies?: boolean
}

interface LeaderboardResponse {
  entries?: LeaderboardEntry[]
}

interface StreakLeaderboardResponse {
  entries?: StreakEntry[]
}

function isStreakEntry(value: unknown): value is StreakEntry {
  if (!value || typeof value !== 'object') return false
  const { name, streakCount } = value as Record<string, unknown>
  return typeof name === 'string' && typeof streakCount === 'number'
}

// A random id purely for keying the streak leaderboard's one-row-per-player
// upsert — arcade-style names collide across devices, so the display name
// alone can't safely identify "this player" the way it can for the
// append-only scores tables. Never shown anywhere, carries no other
// identity, and is generated lazily so a player who never reaches a streak
// worth submitting never gets one written to storage.
function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== 'object') return false
  const { id, name, score, board, endingRoll } = value as Record<string, unknown>
  return (
    typeof id === 'number' &&
    typeof name === 'string' &&
    typeof score === 'number' &&
    (board === null || Array.isArray(board)) &&
    (endingRoll === null || typeof endingRoll === 'number')
  )
}

function isDailyActivityLog(value: unknown): value is DailyActivityLog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.entries(value as Record<string, unknown>).every(([date, entry]) => {
    if (typeof date !== 'string' || !entry || typeof entry !== 'object') return false
    const candidate = entry as { date?: unknown; scoreHistogram?: unknown }
    return typeof candidate.date === 'string' && Array.isArray(candidate.scoreHistogram)
  })
}

function readDailyActivity(): DailyActivityLog {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return isDailyActivityLog(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// Backs the arcade-style "enter your name" prompt: which window(s) a score
// currently qualifies for, submitting a qualifying score, and the name
// itself, remembered across games so it's not retyped every time. Also
// keeps a local, per-day log of every completed game's score and
// qualifying result, so Insights can build a real dashboard (busiest day,
// score trend, closest calls, and so on) without any new server-side
// tracking — one row per calendar date, kept indefinitely, rather than one
// row per game.
export function useLeaderboard() {
  const [name, setName] = useState<string>(() => localStorage.getItem(NAME_KEY) ?? '')
  const [dailyActivity, setDailyActivity] = useState<DailyActivityLog>(readDailyActivity)

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

  const submitScore = useCallback(
    (boardSize: number, playerName: string, score: number, board: (number | null)[], endingRoll: number | null) => {
      localStorage.setItem(NAME_KEY, playerName)
      setName(playerName)
      fetch(`${API_BASE}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize, name: playerName, score, board, endingRoll }),
      }).catch(() => {
        // Best-effort — a failed submission never blocks starting a new game.
      })
    },
    [],
  )

  const fetchLeaderboard = useCallback(async (boardSize: number, window: LeaderboardWindow): Promise<LeaderboardEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/scores/leaderboard?boardSize=${boardSize}&window=${window}`)
      if (!response.ok) return []
      const data = (await response.json()) as LeaderboardResponse
      return Array.isArray(data.entries) ? data.entries.filter(isLeaderboardEntry) : []
    } catch {
      return []
    }
  }, [])

  // Daily challenge leaderboard — scoped to a single calendar date rather
  // than day/week/month/all-time, since the board size changes every day
  // and only players who played the exact same challenge are comparable.
  const checkDailyQualifies = useCallback(async (boardSize: number, date: string, score: number): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/daily-scores/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize, date, score }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as DailyCheckResponse
      return data.qualifies === true
    } catch {
      return false
    }
  }, [])

  const submitDailyScore = useCallback(
    (boardSize: number, date: string, playerName: string, score: number, board: (number | null)[], endingRoll: number | null) => {
      localStorage.setItem(NAME_KEY, playerName)
      setName(playerName)
      fetch(`${API_BASE}/daily-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize, date, name: playerName, score, board, endingRoll }),
      }).catch(() => {
        // Best-effort — a failed submission never blocks closing the recap.
      })
    },
    [],
  )

  const fetchDailyLeaderboard = useCallback(async (boardSize: number, date: string): Promise<LeaderboardEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/daily-scores/leaderboard?boardSize=${boardSize}&date=${date}`)
      if (!response.ok) return []
      const data = (await response.json()) as LeaderboardResponse
      return Array.isArray(data.entries) ? data.entries.filter(isLeaderboardEntry) : []
    } catch {
      return []
    }
  }, [])

  // Silently keeps this device's row on the streak leaderboard current.
  // Only fires once a name has actually been chosen (via a free-play or
  // daily score submission) — an unnamed streak has nothing meaningful to
  // display, so it just doesn't appear until the player has a name.
  const submitStreak = useCallback(
    (streakCount: number, lastPlayedDate: string) => {
      if (!name) return
      const deviceId = getOrCreateDeviceId()
      fetch(`${API_BASE}/streaks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name, streakCount, lastPlayedDate }),
      }).catch(() => {
        // Best-effort — a failed submission just means this device's streak
        // rank goes stale until the next day it's played.
      })
    },
    [name],
  )

  const fetchStreakLeaderboard = useCallback(async (today: string): Promise<StreakEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/streaks/leaderboard?today=${today}`)
      if (!response.ok) return []
      const data = (await response.json()) as StreakLeaderboardResponse
      return Array.isArray(data.entries) ? data.entries.filter(isStreakEntry) : []
    } catch {
      return []
    }
  }, [])

  const recordActivity = useCallback((date: string, score: number, windows: LeaderboardWindow[]) => {
    setDailyActivity(prev => {
      const next = recordGameResult(prev, date, score, windows)
      try {
        window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable — the log just won't persist across reloads.
      }
      return next
    })
  }, [])

  return {
    name,
    dailyActivity,
    checkQualifies,
    submitScore,
    fetchLeaderboard,
    recordActivity,
    checkDailyQualifies,
    submitDailyScore,
    fetchDailyLeaderboard,
    submitStreak,
    fetchStreakLeaderboard,
  }
}
