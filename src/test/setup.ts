import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// useCommunityFeed opens a WebSocket as soon as <App /> mounts. The runtime
// here has a real WebSocket implementation, so without this every test that
// renders the app genuinely dials the deployed worker — slow, flaky, and it
// throws asynchronously long after the test that started it has finished.
// This stub connects to nothing. Tests that want to drive the feed replace it
// and call the handlers themselves.
class SilentWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = SilentWebSocket.CONNECTING
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: ((event: unknown) => void) | null = null

  readonly url: string

  // Written out rather than declared as a constructor parameter property,
  // which this project's erasableSyntaxOnly setting disallows.
  constructor(url: string) {
    this.url = url
  }

  send(): void {}

  close(): void {
    this.readyState = SilentWebSocket.CLOSED
  }
}

// Both useCommunityStats and useLeaderboard fetch (or POST) on every mount
// or completed game, so any test rendering <App /> would otherwise hit the
// real network. Individual tests that care about a specific response
// override this with their own vi.stubGlobal('fetch', ...) — this just
// re-establishes safe, empty defaults before every test: an all-zero
// community matrix, and a leaderboard check that never qualifies.
// jsdom has no matchMedia at all, and usePushReminder asks about display-mode
// the moment <App /> mounts. Answering "not standalone" is both what a test
// browser is and what keeps the reminder screen in its ordinary state; a test
// that wants the installed-app case overrides this.
function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', SilentWebSocket)
  stubMatchMedia()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/scores/check')) {
        return Promise.resolve(new Response(JSON.stringify({ windows: [] }), { status: 200 }))
      }
      if (url.includes('/scores/leaderboard')) {
        return Promise.resolve(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      }
      if (url.includes('/scores')) {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))
    }),
  )
})
