import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// Both useCommunityStats and useLeaderboard fetch (or POST) on every mount
// or completed game, so any test rendering <App /> would otherwise hit the
// real network. Individual tests that care about a specific response
// override this with their own vi.stubGlobal('fetch', ...) — this just
// re-establishes safe, empty defaults before every test: an all-zero
// community matrix, and a leaderboard check that never qualifies.
beforeEach(() => {
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
