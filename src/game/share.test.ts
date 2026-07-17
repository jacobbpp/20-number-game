import { describe, expect, it } from 'vitest'
import { buildShareText } from './share'
import { BOARD_SIZE } from './types'

describe('buildShareText', () => {
  it('builds a loss summary with an emoji grid matching the filled positions', () => {
    const positions: (number | null)[] = Array(BOARD_SIZE).fill(null)
    positions[0] = 42
    positions[3] = 118
    positions[9] = 500

    const text = buildShareText(positions, 3, false, 'https://example.com/')

    const lines = text.split('\n')
    expect(lines[0]).toBe('Order 20 — 3/20')
    expect(lines[1]).toBe('🟧⬜⬜🟧⬜⬜⬜⬜⬜🟧⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜')
    expect(lines[2]).toBe('https://example.com/')
  })

  it('builds a win summary with every cell filled', () => {
    const positions = Array.from({ length: BOARD_SIZE }, (_, i) => (i + 1) * 40)

    const text = buildShareText(positions, BOARD_SIZE, true, 'https://example.com/')

    const lines = text.split('\n')
    expect(lines[0]).toBe('Order 20 — perfect! 20/20')
    expect(lines[1]).toBe('🟧'.repeat(BOARD_SIZE))
  })
})
