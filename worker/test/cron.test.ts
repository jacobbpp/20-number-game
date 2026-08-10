import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { REMINDER_CRON, ROLLUP_CRON } from '../src/index'

// scheduled() picks its branch by comparing controller.cron against a string.
// If wrangler.toml and those constants ever drift apart, nothing breaks
// loudly: the reminder simply never fires and the roll-up quietly runs twice.
// This reads the file that is actually deployed and checks they still agree.
function declaredCrons(): string[] {
  const line = /^\s*crons\s*=\s*\[(.*)\]/m.exec(env.TEST_WRANGLER_TOML)
  if (!line) throw new Error('wrangler.toml has no crons entry')
  return [...line[1].matchAll(/"([^"]+)"/g)].map(match => match[1])
}

describe('the schedules on disk', () => {
  it('include the roll-up the handler branches on', () => {
    expect(declaredCrons()).toContain(ROLLUP_CRON)
  })

  it('include the daily reminder the handler branches on', () => {
    expect(declaredCrons()).toContain(REMINDER_CRON)
  })

  it('declare nothing that would reach the handler unrecognised', () => {
    expect(declaredCrons().sort()).toEqual([REMINDER_CRON, ROLLUP_CRON].sort())
  })

  it('puts the reminder at a civilised hour', () => {
    // 08:00 UTC is 9am British summer time. A minute or hour field that drifts
    // into the middle of the night is the kind of mistake nobody notices until
    // the phone buzzes at 1am.
    const [minute, hour] = REMINDER_CRON.split(' ')
    expect(minute).toBe('0')
    expect(Number(hour)).toBeGreaterThanOrEqual(6)
    expect(Number(hour)).toBeLessThanOrEqual(10)
  })
})
