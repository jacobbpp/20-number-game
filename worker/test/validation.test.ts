import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

// Every write endpoint validates its body and returns 400 rather than storing
// something malformed. None of that was covered before: the boundaries were
// only ever exercised by accident, and a fixture that quietly fell outside one
// looked like a bug in whatever assertion failed three steps later.

function post(path: string, body: unknown) {
  return SELF.fetch(`http://example.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function gameLog(overrides: Record<string, unknown> = {}) {
  return { deviceId: 'device-aaa', name: 'AAA', date: '2026-03-01', mode: 'freeplay', boardSize: 20, placedCount: 12, ...overrides }
}

function score(overrides: Record<string, unknown> = {}) {
  return { boardSize: 20, name: 'AAA', score: 12, ...overrides }
}

describe('POST /games validation', () => {
  it('accepts a well-formed body', async () => {
    expect((await post('/games', gameLog())).status).toBe(204)
  })

  it('requires a deviceId of at least 8 characters', async () => {
    // The one that actually bit: 'dev-a' is a perfectly reasonable-looking
    // fixture id and silently 400s.
    expect((await post('/games', gameLog({ deviceId: 'dev-a' }))).status).toBe(400)
    expect((await post('/games', gameLog({ deviceId: 'a'.repeat(7) }))).status).toBe(400)
    expect((await post('/games', gameLog({ deviceId: 'a'.repeat(8) }))).status).toBe(204)
  })

  it('caps deviceId at 64 characters', async () => {
    expect((await post('/games', gameLog({ deviceId: 'a'.repeat(64) }))).status).toBe(204)
    expect((await post('/games', gameLog({ deviceId: 'a'.repeat(65) }))).status).toBe(400)
  })

  it('rejects a deviceId containing anything but letters, digits and hyphens', async () => {
    expect((await post('/games', gameLog({ deviceId: 'device aaa' }))).status).toBe(400)
    expect((await post('/games', gameLog({ deviceId: 'device_aaa' }))).status).toBe(400)
    expect((await post('/games', gameLog({ deviceId: 'device.aaa' }))).status).toBe(400)
  })

  it('allows placedCount from zero up to the board size, and no further', async () => {
    // The other one that bit: placedCount 24 on a 20-slot board.
    expect((await post('/games', gameLog({ placedCount: 0 }))).status).toBe(204)
    expect((await post('/games', gameLog({ placedCount: 20 }))).status).toBe(204)
    expect((await post('/games', gameLog({ placedCount: 21 }))).status).toBe(400)
    expect((await post('/games', gameLog({ placedCount: -1 }))).status).toBe(400)
  })

  it('measures placedCount against the board size given, not a fixed 20', async () => {
    expect((await post('/games', gameLog({ mode: 'daily', boardSize: 30, placedCount: 25 }))).status).toBe(204)
    expect((await post('/games', gameLog({ mode: 'daily', boardSize: 10, placedCount: 25 }))).status).toBe(400)
  })

  it('only accepts board sizes the game can actually deal', async () => {
    for (const boardSize of [10, 15, 20, 25, 30]) {
      expect((await post('/games', gameLog({ boardSize, placedCount: 5 }))).status).toBe(204)
    }
    for (const boardSize of [0, 5, 21, 40]) {
      expect((await post('/games', gameLog({ boardSize, placedCount: 5 }))).status).toBe(400)
    }
  })

  it('only accepts the two real modes', async () => {
    expect((await post('/games', gameLog({ mode: 'daily' }))).status).toBe(204)
    expect((await post('/games', gameLog({ mode: 'practice' }))).status).toBe(400)
    expect((await post('/games', gameLog({ mode: '' }))).status).toBe(400)
  })

  it('requires a YYYY-MM-DD date', async () => {
    expect((await post('/games', gameLog({ date: '2026-3-1' }))).status).toBe(400)
    expect((await post('/games', gameLog({ date: '01/03/2026' }))).status).toBe(400)
    expect((await post('/games', gameLog({ date: '' }))).status).toBe(400)
  })

  it('accepts a null name, since most games are logged before one is chosen', async () => {
    expect((await post('/games', gameLog({ name: null }))).status).toBe(204)
  })

  it('rejects a body that is not JSON at all', async () => {
    const response = await SELF.fetch('http://example.com/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(response.status).toBe(400)
  })
})

describe('POST /scores validation', () => {
  it('accepts a well-formed body', async () => {
    expect((await post('/scores', score())).status).toBe(204)
  })

  it('requires a score of at least 1, unlike a game log which may be zero', async () => {
    expect((await post('/scores', score({ score: 0 }))).status).toBe(400)
    expect((await post('/scores', score({ score: 1 }))).status).toBe(204)
  })

  it('rejects a score above the board size', async () => {
    expect((await post('/scores', score({ score: 20 }))).status).toBe(204)
    expect((await post('/scores', score({ score: 21 }))).status).toBe(400)
  })

  it('allows names of one to eight letters, digits or spaces', async () => {
    expect((await post('/scores', score({ name: 'A' }))).status).toBe(204)
    expect((await post('/scores', score({ name: 'AB CD 12' }))).status).toBe(204)
    expect((await post('/scores', score({ name: '' }))).status).toBe(400)
    expect((await post('/scores', score({ name: '   ' }))).status).toBe(400)
    expect((await post('/scores', score({ name: 'TOOLONGNAME' }))).status).toBe(400)
    expect((await post('/scores', score({ name: 'BAD!' }))).status).toBe(400)
  })

  it('requires a board array matching the declared board size, if one is sent', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => (i + 1) * 10)
    expect((await post('/scores', score({ board: twenty }))).status).toBe(204)
    expect((await post('/scores', score({ board: twenty.slice(0, 19) }))).status).toBe(400)
    expect((await post('/scores', score({ board: [...twenty, 999] }))).status).toBe(400)
  })

  it('accepts nulls inside the board for positions never filled', async () => {
    const partial = Array.from({ length: 20 }, (_, i) => (i < 12 ? (i + 1) * 10 : null))
    expect((await post('/scores', score({ board: partial }))).status).toBe(204)
  })

  it('rejects board values outside the 1 to 1000 range the game rolls', async () => {
    const withZero = Array.from({ length: 20 }, (_, i) => (i === 0 ? 0 : (i + 1) * 10))
    const withOverflow = Array.from({ length: 20 }, (_, i) => (i === 0 ? 1001 : (i + 1) * 10))
    expect((await post('/scores', score({ board: withZero }))).status).toBe(400)
    expect((await post('/scores', score({ board: withOverflow }))).status).toBe(400)
  })

  it('treats board and endingRoll as optional, for clients cached before they existed', async () => {
    expect((await post('/scores', score())).status).toBe(204)
    expect((await post('/scores', score({ endingRoll: null }))).status).toBe(204)
    expect((await post('/scores', score({ endingRoll: 552 }))).status).toBe(204)
    expect((await post('/scores', score({ endingRoll: 1001 }))).status).toBe(400)
  })
})

describe('unknown routes', () => {
  it('404s rather than falling through to something else', async () => {
    expect((await SELF.fetch('http://example.com/nope')).status).toBe(404)
    expect((await post('/placements/summary', {})).status).toBe(404)
  })
})
