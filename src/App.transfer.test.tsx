import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STATS_STORAGE_KEY } from './hooks/useGameStats'
import { APP_VERSION } from './version'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

function mockApi(options: { code?: string; claim?: { status: number; payload?: string } } = {}) {
  const { code = 'K7M2QP', claim } = options
  // The init argument is declared so the recorded calls carry the request
  // body: without it the mock's call tuple has length one and reading the
  // second element is a type error, not just an empty value.
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (url.includes('/transfer/claim')) {
      const status = claim?.status ?? 200
      if (status !== 200) return Promise.resolve(new Response(JSON.stringify({ error: 'nope' }), { status }))
      return Promise.resolve(new Response(JSON.stringify({ payload: claim?.payload ?? '{}' }), { status: 200 }))
    }
    if (url.includes('/transfer/status')) {
      return Promise.resolve(new Response(JSON.stringify({ claimed: false }), { status: 200 }))
    }
    if (url.includes('/transfer')) {
      return Promise.resolve(
        new Response(JSON.stringify({ code, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() }), { status: 200 }),
      )
    }
    if (url.includes('/community/yesterday')) {
      return Promise.resolve(new Response(JSON.stringify({ date: '2026-03-01', summary: null }), { status: 200 }))
    }
    if (url.includes('/activity')) {
      return Promise.resolve(new Response(JSON.stringify({ events: [], playing: 0 }), { status: 200 }))
    }
    if (url.includes('/scores/check')) {
      return Promise.resolve(new Response(JSON.stringify({ windows: [] }), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function openTransfer() {
  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
  fireEvent.click(await screen.findByRole('button', { name: /Move my game/ }))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  cleanup()
})

describe('move my game', () => {
  it('opens from Settings and asks which device you are holding', async () => {
    mockApi()
    render(<App />)
    await openTransfer()

    expect(await screen.findByText('Which device are you holding right now?')).toBeInTheDocument()
    expect(screen.getByText('The one with my game')).toBeInTheDocument()
    expect(screen.getByText('The new, empty one')).toBeInTheDocument()
  })

  it('shows the illustrated guide, with a described diagram for every step', async () => {
    mockApi()
    render(<App />)
    await openTransfer()

    // The diagrams are the point of the guide, so each one has to carry a
    // description rather than being decorative.
    expect(await screen.findByRole('img', { name: /settings list/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /six character code/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /passing from the old phone/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /stats, streak and achievements/i })).toBeInTheDocument()

    expect(screen.getByText('Start on your old device')).toBeInTheDocument()
    expect(screen.getByText('Everything lands')).toBeInTheDocument()
  })

  it('says plainly that it is a one-time move', async () => {
    mockApi()
    render(<App />)
    await openTransfer()

    expect(await screen.findByText(/does not keep two devices in step/i)).toBeInTheDocument()
  })

  it('mints a code on the sending device and lists what travels', async () => {
    mockApi({ code: 'K7M2QP' })
    render(<App />)
    await openTransfer()

    fireEvent.click(await screen.findByText('The one with my game'))

    expect(await screen.findByText('K7M2QP')).toBeInTheDocument()
    expect(screen.getByText(/Expires in/)).toBeInTheDocument()
    expect(screen.getByText('Daily streak and history')).toBeInTheDocument()
  })

  it('sends the allowlisted keys and not the device id', async () => {
    localStorage.setItem('order20-best-score', '18')
    localStorage.setItem('order20-device-id', 'device-should-not-travel')
    const fetchMock = mockApi()

    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The one with my game'))
    await screen.findByText('K7M2QP')

    const createCall = fetchMock.mock.calls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : ''
      return url.endsWith('/transfer')
    })
    expect(createCall).toBeDefined()

    const rawBody = createCall?.[1]?.body
    expect(typeof rawBody).toBe('string')
    const body = JSON.parse(String(rawBody)) as { payload: string }

    expect(body.payload).toContain('order20-best-score')
    expect(body.payload).not.toContain('device-should-not-travel')
  })

  it('warns before overwriting on the receiving device', async () => {
    mockApi()
    render(<App />)
    await openTransfer()

    fireEvent.click(await screen.findByText('The new, empty one'))

    expect(await screen.findByText(/replaces whatever is on this device/i)).toBeInTheDocument()
  })

  it('only enables the button once six characters are in', async () => {
    mockApi()
    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The new, empty one'))

    const button = await screen.findByRole('button', { name: 'Bring my game here' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Transfer code'), { target: { value: 'K7M2QP' } })
    expect(button).toBeEnabled()
  })

  it('uppercases what you type, so a lowercase code still works', async () => {
    mockApi()
    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The new, empty one'))

    const input = (await screen.findByLabelText('Transfer code')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'k7m2qp' } })

    expect(input.value).toBe('K7M2QP')
  })

  it('applies an arriving game and summarises what came across', async () => {
    mockApi({
      claim: {
        status: 200,
        payload: JSON.stringify({
          'order20-best-score': '18',
          'order20-daily-streak': JSON.stringify({ count: 7 }),
          'order20-achievements-unlocked': JSON.stringify({ a: 1, b: 2, c: 3 }),
        }),
      },
    })
    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The new, empty one'))

    fireEvent.change(screen.getByLabelText('Transfer code'), { target: { value: 'K7M2QP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bring my game here' }))

    expect(await screen.findByText('Your game is here')).toBeInTheDocument()
    expect(screen.getByText(/Best score 18/)).toBeInTheDocument()
    expect(screen.getByText(/7 day streak/)).toBeInTheDocument()
    expect(localStorage.getItem('order20-best-score')).toBe('18')
  })

  it('explains a rejected code instead of failing silently', async () => {
    mockApi({ claim: { status: 404 } })
    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The new, empty one'))

    fireEvent.change(screen.getByLabelText('Transfer code'), { target: { value: 'K7M2QP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bring my game here' }))

    expect(await screen.findByText(/expired or has already been used/i)).toBeInTheDocument()
    // Nothing was written, so the device is untouched.
    expect(localStorage.getItem('order20-best-score')).toBeNull()
  })

  it('tells you to retry the same code when the network is the problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : ''
        if (url.includes('/transfer/claim')) return Promise.reject(new Error('offline'))
        return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
      }),
    )
    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The new, empty one'))

    fireEvent.change(screen.getByLabelText('Transfer code'), { target: { value: 'K7M2QP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bring my game here' }))

    expect(await screen.findByText(/try the same code again/i)).toBeInTheDocument()
  })

  it('offers to clear the old device once the code has been collected', async () => {
    let claimed = false
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : ''
        if (url.includes('/transfer/status')) {
          const body = JSON.stringify({ claimed })
          claimed = true
          return Promise.resolve(new Response(body, { status: 200 }))
        }
        if (url.includes('/transfer')) {
          return Promise.resolve(
            new Response(JSON.stringify({ code: 'K7M2QP', expiresAt: new Date(Date.now() + 900000).toISOString() }), { status: 200 }),
          )
        }
        return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
      }),
    )

    render(<App />)
    await openTransfer()
    fireEvent.click(await screen.findByText('The one with my game'))
    await screen.findByText('K7M2QP')

    // Nothing is deleted on its own: the old device offers, and waits.
    await waitFor(() => expect(screen.getByText('Your game moved')).toBeInTheDocument(), { timeout: 8000 })
    expect(screen.getByRole('button', { name: 'Clear this device' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave it as it is' })).toBeInTheDocument()
    // Longer than the default: the status poll only fires every three seconds,
    // and this is deliberately exercising the real interval rather than a
    // fake clock, since the polling loop is the thing under test.
  }, 15000)

  it('is described in the app guide as well as in the flow', async () => {
    mockApi()
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        totalGames: 1,
        totalWins: 0,
        totalTurns: 2,
        currentWinStreak: 0,
        matrix: emptyMatrix(),
        winMatrix: emptyMatrix(),
        lossMatrix: emptyMatrix(),
        scoreDistribution: [1],
        lossBucketCounts: Array(10).fill(0),
        lastGame: null,
      }),
    )
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('button', { name: /Learn about the app/ }))

    const guide = await screen.findByText('Move my game')
    expect(within(guide.closest('div') as HTMLElement).getByText(/one-time move/i)).toBeInTheDocument()
  })
})
