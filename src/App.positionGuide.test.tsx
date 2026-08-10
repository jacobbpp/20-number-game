import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { APP_VERSION } from './version'

const SUGGESTED = /empty, valid placement, suggested for this number$/

// Seeds a game mid-roll so the board under test is exactly the one described,
// rather than whatever a sequence of random rolls happens to produce.
function seedRolledGame(currentRoll: number, placed: Record<number, number> = {}) {
  const positions: (number | null)[] = Array(20).fill(null)
  for (const [slot, value] of Object.entries(placed)) positions[Number(slot)] = value

  const validPositions = positions
    .map((_, slot) => slot)
    .filter(slot => {
      if (positions[slot] !== null) return false
      const before = positions.slice(0, slot).filter(v => v !== null) as number[]
      const after = positions.slice(slot + 1).filter(v => v !== null) as number[]
      const lower = before.length > 0 ? before[before.length - 1] : -Infinity
      const upper = after.length > 0 ? after[0] : Infinity
      return currentRoll > lower && currentRoll < upper
    })

  localStorage.setItem(
    'order20-current-game',
    JSON.stringify({
      positions,
      usedNumbers: [...Object.values(placed), currentRoll],
      currentRoll,
      validPositions,
      placedCount: Object.keys(placed).length,
      status: 'rolled',
      lossReason: null,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('order20-onboarded', '1')
  localStorage.setItem('order20-show-home-screen', '0')
  localStorage.setItem('order20-whatsnew-seen-version', APP_VERSION)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

describe('the suggested position', () => {
  it('marks where the number belongs on an open board', async () => {
    // 250 is roughly a quarter of the way up the range, so on an empty board
    // it belongs roughly a quarter of the way down.
    seedRolledGame(250)

    render(<App />)

    expect(await screen.findByRole('button', { name: /^Position 6, empty, valid placement, suggested/ })).toBeInTheDocument()
  })

  it('marks only one position', async () => {
    seedRolledGame(250)

    render(<App />)

    await screen.findByRole('button', { name: SUGGESTED })
    expect(screen.getAllByRole('button', { name: SUGGESTED })).toHaveLength(1)
  })

  it('places by the gap the number lands in, not by its size on the board', async () => {
    // This is the whole reason the suggestion was rewritten. 515 sits about
    // halfway along 1 to 1000, so judging it against the board says "about
    // position 10". But it has to fit between an existing 480 and 520, and
    // against that pair it is nearly as big as the 520, so it belongs near
    // the far end of the room left between them.
    seedRolledGame(515, { 2: 480, 17: 520 })

    render(<App />)

    expect(await screen.findByRole('button', { name: /^Position 15, empty, valid placement, suggested/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Position 11, empty, valid placement, suggested/ })).not.toBeInTheDocument()
  })

  it('appears with no community history behind it at all', async () => {
    // The old suggestion was read from the community placement matrix and so
    // showed nothing until enough other people had played. A brand new player
    // on a brand new board got no help from it whatsoever. This one is worked
    // out from the board in front of them, so there is nothing to wait for.
    seedRolledGame(250)

    render(<App />)

    expect(await screen.findByRole('button', { name: SUGGESTED })).toBeInTheDocument()
  })

  it('survives the stats API being unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    seedRolledGame(250)

    render(<App />)

    expect(await screen.findByRole('button', { name: SUGGESTED })).toBeInTheDocument()
  })

  it('says nothing when only one position is legal', async () => {
    // 490 can only go in the single empty slot between 480 and 500. Pointing
    // at the only option available is noise.
    seedRolledGame(490, { 2: 480, 4: 500 })

    render(<App />)

    await screen.findByRole('button', { name: /^Position 4, empty, valid placement/ })
    expect(screen.queryByRole('button', { name: SUGGESTED })).not.toBeInTheDocument()
  })

  it('never appears in hard mode', async () => {
    // Hard mode hides which positions are even legal, so a dot narrowing them
    // down would hand back exactly what was turned off.
    localStorage.setItem('order20-hard-mode', '1')
    seedRolledGame(250)

    render(<App />)

    await screen.findByRole('button', { name: 'Position 1, empty' })
    expect(screen.queryByRole('button', { name: SUGGESTED })).not.toBeInTheDocument()
    expect(document.querySelector('.slot__suggested')).toBeNull()
  })
})
