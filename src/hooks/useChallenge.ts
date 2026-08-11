import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '../api'
import {
  CHALLENGE_BOARD_SIZE,
  createChallengeRng,
  mintChallengeCode,
  normaliseCode,
  type ChallengeRecord,
} from '../game/challenge'
import { place, roll } from '../game/engine'
import { createInitialState, isGameState, type GameState } from '../game/types'
import { vibrate } from '../utils/haptics'
import { playSound } from '../utils/sound'

const STORAGE_KEY = 'order20-challenge'

export type ChallengeRole = 'challenger' | 'opponent'

interface StoredChallenge {
  code: string
  role: ChallengeRole
  boardSize: number
  game: GameState
  // Set once this side's score has reached the server, so a refresh after
  // finishing cannot submit the same run twice.
  submitted: boolean
}

function isStored(value: unknown): value is StoredChallenge {
  if (!value || typeof value !== 'object') return false
  const { code, role, boardSize, game, submitted } = value as Record<string, unknown>
  return (
    typeof code === 'string' &&
    (role === 'challenger' || role === 'opponent') &&
    typeof boardSize === 'number' &&
    typeof submitted === 'boolean' &&
    isGameState(game)
  )
}

function read(): StoredChallenge | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isStored(parsed) ? parsed : null
  } catch {
    return null
  }
}

function write(value: StoredChallenge | null) {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable. The challenge just will not survive a refresh.
  }
}

// A board dealt from a code rather than from chance, so the person at the
// other end gets exactly the same game.
function dealFrom(code: string, boardSize: number): GameState {
  return roll(createInitialState(boardSize), createChallengeRng(code))
}

export interface Challenge {
  code: string | null
  role: ChallengeRole | null
  game: GameState | null
  // What the server knows. Null until it has been asked.
  record: ChallengeRecord | null
  busy: boolean
  error: string | null
  start: () => void
  open: (code: string) => Promise<void>
  select: (index: number) => void
  refresh: () => Promise<void>
  clear: () => void
}

// Everything about a head to head: the board, whose it is, and what the
// server has been told. Deliberately silent — nobody is notified that a
// challenge has been answered, because the reminder screen promises the daily
// nudge is the only thing this app will ever send.
export function useChallenge(playerName: string): Challenge {
  const [stored, setStored] = useState<StoredChallenge | null>(read)
  const [record, setRecord] = useState<ChallengeRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One live generator per code, held across renders so the rolls keep coming
  // in sequence rather than restarting on every placement.
  //
  // After a refresh this is rebuilt from the start of the sequence, which is
  // fine and is how the daily challenge survives one too: rollNumber skips
  // anything already in usedNumbers, so replaying the opening rolls lands
  // exactly on the next unused one. Both players end up on the same board
  // whether or not either of them reloaded partway through.
  const rngRef = useRef<{ code: string; next: () => number } | null>(null)

  const rngFor = useCallback((code: string) => {
    if (rngRef.current?.code !== code) {
      rngRef.current = { code, next: createChallengeRng(code) }
    }
    return rngRef.current.next
  }, [])

  useEffect(() => {
    write(stored)
  }, [stored])

  const fetchRecord = useCallback(
    async (code: string) => {
      const query = playerName ? `&name=${encodeURIComponent(playerName)}` : ''
      const response = await fetch(`${API_BASE}/challenge?code=${encodeURIComponent(code)}${query}`)
      if (!response.ok) return null
      const body = (await response.json()) as { challenge?: ChallengeRecord }
      return body.challenge ?? null
    },
    [playerName],
  )

  const start = useCallback(() => {
    const code = mintChallengeCode()
    setError(null)
    setRecord(null)
    setStored({ code, role: 'challenger', boardSize: CHALLENGE_BOARD_SIZE, game: dealFrom(code, CHALLENGE_BOARD_SIZE), submitted: false })
  }, [])

  const open = useCallback(
    async (raw: string) => {
      const code = normaliseCode(raw)
      setBusy(true)
      setError(null)

      try {
        const found = await fetchRecord(code)
        if (!found) {
          setError('No challenge with that code. It may have expired.')
          return
        }
        if (found.opponentScore !== null) {
          // Already answered by somebody. Show it rather than dealing a board
          // whose result could never be recorded.
          setRecord(found)
          setStored(null)
          return
        }

        setRecord(found)
        setStored({ code, role: 'opponent', boardSize: found.boardSize, game: dealFrom(code, found.boardSize), submitted: false })
      } catch {
        setError('Could not reach the challenge. Try again in a moment.')
      } finally {
        setBusy(false)
      }
    },
    [fetchRecord],
  )

  const submit = useCallback(
    async (current: StoredChallenge, score: number) => {
      setBusy(true)
      try {
        if (current.role === 'challenger') {
          const response = await fetch(`${API_BASE}/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: current.code, boardSize: current.boardSize, name: playerName, score }),
          })
          if (!response.ok) throw new Error('could not create')

          setRecord({
            code: current.code,
            boardSize: current.boardSize,
            challengerName: playerName,
            challengerScore: score,
            opponentName: null,
            opponentScore: null,
          })
        } else {
          const response = await fetch(`${API_BASE}/challenge/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: current.code, name: playerName, score }),
          })
          if (!response.ok) throw new Error('could not answer')

          const body = (await response.json()) as { challenge?: ChallengeRecord }
          if (body.challenge) setRecord(body.challenge)
        }

        setStored({ ...current, submitted: true })
      } catch {
        setError('Your score is saved on this device but did not reach the others. Reopen to try again.')
      } finally {
        setBusy(false)
      }
    },
    [playerName],
  )

  const select = useCallback(
    (index: number) => {
      if (!stored || stored.submitted) return

      const placed = place(stored.game, index)
      if (placed === stored.game) return

      const next = placed.status === 'won' ? placed : roll(placed, rngFor(stored.code))
      const finished = next.status === 'won' || next.status === 'lost'

      setStored({ ...stored, game: next })

      if (finished) {
        vibrate(next.status === 'won' ? 'win' : 'lose')
        playSound(next.status === 'won' ? 'win' : 'lose')
        void submit({ ...stored, game: next }, next.placedCount)
      }
    },
    [stored, submit, rngFor],
  )

  const refresh = useCallback(async () => {
    if (!stored) return
    setBusy(true)
    try {
      const found = await fetchRecord(stored.code)
      if (found) setRecord(found)
    } catch {
      // Offline. What is on screen is the last thing known to be true.
    } finally {
      setBusy(false)
    }
  }, [stored, fetchRecord])

  const clear = useCallback(() => {
    setStored(null)
    setRecord(null)
    setError(null)
  }, [])

  return {
    code: stored?.code ?? record?.code ?? null,
    role: stored?.role ?? null,
    game: stored?.game ?? null,
    record,
    busy,
    error,
    start,
    open,
    select,
    refresh,
    clear,
  }
}
