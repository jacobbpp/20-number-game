import { describe, expect, it } from 'vitest'
import { buildDailyShareText, buildShareText, buildStreakShareText, formatDailyDateLabel } from './share'
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

describe('formatDailyDateLabel', () => {
  it('formats a YYYY-MM-DD string as a short month + day', () => {
    expect(formatDailyDateLabel('2026-07-17')).toBe('Jul 17')
    expect(formatDailyDateLabel('2026-01-05')).toBe('Jan 5')
  })
})

describe('buildDailyShareText', () => {
  it('includes the date label in the headline', () => {
    const positions: (number | null)[] = Array(BOARD_SIZE).fill(null)
    positions[0] = 42

    const text = buildDailyShareText(positions, 1, false, '2026-07-17', 'https://example.com/')

    const lines = text.split('\n')
    expect(lines[0]).toBe('Order 20 Daily (Jul 17) — 1/20')
    expect(lines[1]).toBe(`🟧${'⬜'.repeat(BOARD_SIZE - 1)}`)
    expect(lines[2]).toBe('https://example.com/')
  })

  it('marks a win as perfect, same as the free-play share text', () => {
    const positions = Array.from({ length: BOARD_SIZE }, (_, i) => (i + 1) * 40)

    const text = buildDailyShareText(positions, BOARD_SIZE, true, '2026-07-17', 'https://example.com/')

    expect(text.split('\n')[0]).toBe('Order 20 Daily (Jul 17) — perfect! 20/20')
  })

  it('denominates by the actual board size, not a fixed 20 — daily sizes vary', () => {
    const positions: (number | null)[] = Array(10).fill(null)
    positions[0] = 55

    const text = buildDailyShareText(positions, 1, false, '2026-07-17', 'https://example.com/')

    const lines = text.split('\n')
    expect(lines[0]).toBe('Order 20 Daily (Jul 17) — 1/10')
    expect(lines[1]).toBe(`🟧${'⬜'.repeat(9)}`)
  })
})

describe('buildStreakShareText', () => {
  it('includes the streak count and the url', () => {
    const text = buildStreakShareText({ count: 7, lastPlayedDate: '2026-07-17' }, 'https://example.com/')

    const lines = text.split('\n')
    expect(lines[0]).toBe('🔥 7 day streak on Order 20 Daily!')
    expect(lines[1]).toBe('https://example.com/')
  })
})
