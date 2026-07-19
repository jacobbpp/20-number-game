import { useCallback, useState } from 'react'
import { API_BASE } from '../api'

export type LeaderboardWindow = 'day' | 'week' | 'month' | 'all'

export interface LeaderboardEntry {
  name: string
  score: number
}

const NAME_KEY = 'order20-leaderboard-name'

interface CheckResponse {
  windows?: string[]
}

interface LeaderboardResponse {
  entries?: LeaderboardEntry[]
}

// Backs the arcade-style "enter your name" prompt: which window(s) a score
// currently qualifies for, submitting a qualifying score, and the name
// itself, remembered across games so it's not retyped every time.
export function useLeaderboard() {
  const [name, setName] = useState<string>(() => localStorage.getItem(NAME_KEY) ?? '')

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

  return { name, checkQualifies, submitScore, fetchLeaderboard }
}
