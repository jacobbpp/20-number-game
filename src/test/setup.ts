import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

function emptyMatrix() {
  return Array.from({ length: 20 }, () => Array(10).fill(0))
}

// useCommunityStats fetches on every mount, so any test rendering <App />
// would otherwise hit the real network. Individual tests that care about
// the response can override this with their own vi.stubGlobal('fetch', ...)
// — this just re-establishes a safe, all-zero default before every test.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ boardSize: 20, matrix: emptyMatrix() }), { status: 200 }))),
  )
})
