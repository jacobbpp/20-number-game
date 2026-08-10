import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { place, roll } from '../game/engine'
import {
  SHORT_BOARD_SIZE,
  createEmptyShortRecord,
  isShortRecord,
  recordShortGame,
  type CommunityRecord,
  type ShortRecord,
} from '../game/shortBoard'
import { createInitialState, isGameState, type GameState } from '../game/types'
import { vibrate } from '../utils/haptics'
import { playSound } from '../utils/sound'

const UNLOCKED_KEY = 'order20-short-unlocked'
const RECORD_KEY = 'order20-short-record'
// Its own saved game, not the free-play one. Switching to the short board
// must never cost somebody a twenty they were partway through.
const GAME_KEY = 'order20-short-game'

function read<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable. Progress and the record just will not survive a
    // refresh; nothing here is worth failing a game over.
  }
}

function readUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(UNLOCKED_KEY) === '1'
  } catch {
    return false
  }
}

function freshGame(): GameState {
  return roll(createInitialState(SHORT_BOARD_SIZE))
}

export interface ShortBoard {
  unlocked: boolean
  unlock: () => void
  record: ShortRecord
  // Null until the worker answers, and stays null if it never does. The
  // reveal words itself differently in that case rather than waiting.
  community: CommunityRecord | null
  loadCommunity: () => void
  // Null until the mode has been opened for the first time, so a player who
  // has never found it is not carrying a saved game they cannot see.
  state: GameState | null
  start: () => void
  restart: () => void
  select: (index: number) => void
}

// Everything about the short board in one place: whether it has been found,
// how it has gone, and the game itself. It owns its own loop rather than
// borrowing the free-play one, which keeps it entirely clear of the leaderboard
// submission, community reporting and daily streak that App wires around that.
export function useShortBoard(): ShortBoard {
  const [unlocked, setUnlocked] = useState<boolean>(readUnlocked)
  const [record, setRecord] = useState<ShortRecord>(() => read(RECORD_KEY, isShortRecord) ?? createEmptyShortRecord())
  const [state, setState] = useState<GameState | null>(() => read(GAME_KEY, isGameState))
  const [community, setCommunity] = useState<CommunityRecord | null>(null)

  useEffect(() => {
    if (state) write(GAME_KEY, state)
  }, [state])

  useEffect(() => {
    write(RECORD_KEY, record)
  }, [record])

  const unlock = useCallback(() => {
    setUnlocked(true)
    try {
      window.localStorage.setItem(UNLOCKED_KEY, '1')
    } catch {
      // Found it but cannot remember it. Still playable this session.
    }
  }, [])

  const loadCommunity = useCallback(() => {
    // Fired when the press begins, so this is the only request the feature
    // ever makes and only somebody actually going looking makes it.
    fetch(`${API_BASE}/community/record`)
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        const candidate = body as Partial<CommunityRecord> | null
        if (
          candidate &&
          typeof candidate.games === 'number' &&
          typeof candidate.players === 'number' &&
          typeof candidate.wins === 'number'
        ) {
          setCommunity({ games: candidate.games, players: candidate.players, wins: candidate.wins })
        }
      })
      .catch(() => {
        // Offline, or blocked by CORS in local development. The reveal falls
        // back to the player's own history, which needs no network.
      })
  }, [])

  const start = useCallback(() => {
    setState(current => current ?? freshGame())
  }, [])

  const restart = useCallback(() => {
    setState(freshGame())
  }, [])

  const finish = useCallback((won: boolean) => {
    setRecord(current => recordShortGame(current, won))
    vibrate(won ? 'win' : 'lose')
    playSound(won ? 'win' : 'lose')
  }, [])

  const select = useCallback(
    (index: number) => {
      if (!state) return

      const placed = place(state, index)
      // place() returns the same object for an illegal tap, which is also how
      // hard mode's silent no-op works.
      if (placed === state) return

      if (placed.status === 'won') {
        setState(placed)
        finish(true)
        return
      }

      const next = roll(placed)
      setState(next)
      if (next.status === 'lost') finish(false)
    },
    [state, finish],
  )

  return { unlocked, unlock, record, community, loadCommunity, state, start, restart, select }
}
