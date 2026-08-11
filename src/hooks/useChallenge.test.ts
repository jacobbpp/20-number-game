import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChallenge } from './useChallenge'

interface Sent {
  url: string
  body: Record<string, unknown>
}

// Every write the hook makes, so a test can assert on what actually left the
// device rather than on what the screen says.
function captureFetch(challengeBody: unknown = null) {
  const sent: Sent[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      if (init?.method === 'POST') {
        sent.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> })
        return Promise.resolve(new Response(JSON.stringify({ challenge: challengeBody }), { status: 200 }))
      }
      if (!challengeBody) return Promise.resolve(new Response('{}', { status: 404 }))
      return Promise.resolve(new Response(JSON.stringify({ challenge: challengeBody }), { status: 200 }))
    }),
  )

  return sent
}

// Plays the board out, always taking the first legal slot, which is enough to
// reach the end of a game without caring how well it went.
async function playToTheEnd(result: { current: ReturnType<typeof useChallenge> }) {
  for (let turn = 0; turn < 30; turn++) {
    const game = result.current.game
    if (!game || game.status === 'won' || game.status === 'lost') return
    const next = game.validPositions[0]
    if (next === undefined) return
    await act(async () => {
      result.current.select(next)
    })
  }
}

const OPEN = {
  code: 'K7M2QP',
  boardSize: 20,
  challengerName: 'SJW',
  challengerScore: null,
  invitedName: null,
  opponentName: null,
  opponentScore: null,
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('challenging one person in particular', () => {
  it('tells the server who the code is for', async () => {
    const sent = captureFetch()
    const { result } = renderHook(() => useChallenge('JRC'))

    act(() => {
      result.current.start('YRC')
    })
    await playToTheEnd(result)

    const created = sent.find(request => request.url.endsWith('/challenge'))
    expect(created?.body.invitedName).toBe('YRC')
    expect(created?.body.name).toBe('JRC')
  })

  it('sends nothing when it is open to anybody', async () => {
    const sent = captureFetch()
    const { result } = renderHook(() => useChallenge('JRC'))

    act(() => {
      result.current.start()
    })
    await playToTheEnd(result)

    expect(sent.find(request => request.url.endsWith('/challenge'))?.body.invitedName).toBeNull()
  })

  it('remembers who it was for while it is being played', () => {
    captureFetch()
    const { result } = renderHook(() => useChallenge('JRC'))

    act(() => {
      result.current.start('DAD')
    })

    expect(result.current.invitedName).toBe('DAD')
  })
})

describe('answering one addressed to somebody else', () => {
  it('says so before a single roll is played', async () => {
    // Turning it away after twenty rolls would be the worst version of this:
    // the server would refuse the score, and the game would have been for
    // nothing.
    captureFetch({ ...OPEN, invitedName: 'YRC' })
    const { result } = renderHook(() => useChallenge('JRC'))

    await act(async () => {
      await result.current.open('K7M2QP')
    })

    expect(result.current.game).toBeNull()
    expect(result.current.error).toContain('YRC')
  })

  it('deals the board when it was addressed to you', async () => {
    captureFetch({ ...OPEN, invitedName: 'JRC' })
    const { result } = renderHook(() => useChallenge('JRC'))

    await act(async () => {
      await result.current.open('K7M2QP')
    })

    expect(result.current.game).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('deals the board when it was open to anybody', async () => {
    captureFetch(OPEN)
    const { result } = renderHook(() => useChallenge('JRC'))

    await act(async () => {
      await result.current.open('K7M2QP')
    })

    expect(result.current.game).not.toBeNull()
  })
})

describe('a challenge saved before challenges could name anybody', () => {
  it('is still playable rather than being thrown away', () => {
    // The shape stored by v1.55 has no invitedName at all, and somebody could
    // be halfway through one when the update lands.
    localStorage.setItem(
      'order20-challenge',
      JSON.stringify({
        code: 'K7M2QP',
        role: 'challenger',
        boardSize: 20,
        submitted: false,
        game: {
          positions: Array(20).fill(null),
          validPositions: Array.from({ length: 20 }, (_, index) => index),
          currentRoll: 500,
          usedNumbers: [500],
          placedCount: 0,
          status: 'rolled',
        },
      }),
    )
    captureFetch()

    const { result } = renderHook(() => useChallenge('JRC'))

    expect(result.current.code).toBe('K7M2QP')
    expect(result.current.invitedName).toBeNull()
  })
})
