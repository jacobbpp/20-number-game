import { env, SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

interface PlacementRow {
  position: number
  value_bucket: number
  count: number
}

function postPlacements(body: unknown) {
  return SELF.fetch('http://example.com/placements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// D1 caps queries at 50 per invocation on the free plan (1000 on paid), and
// counts every statement in a batch — not the batch call — against that
// limit. One INSERT per placement, across both placements and
// device_placements, would have cost up to 60 statements on the largest
// (30-position) board, silently failing on the free plan without the
// caller ever seeing an error (the client's reportPlacements fire-and-
// forgets with a bare .catch()). This is the regression test for that: a
// full 30-position board must still round-trip into both tables now that
// inserts are batched into a handful of multi-row statements instead.
describe('POST /placements', () => {
  it('round-trips a full 30-position board into both placements and device_placements', async () => {
    const placements = Array.from({ length: 30 }, (_, position) => ({ position, valueBucket: position % 10 }))
    const deviceId = 'test-device-full-board'

    const response = await postPlacements({ boardSize: 30, placements, deviceId })
    expect(response.status).toBe(204)

    const community = await env.DB.prepare('SELECT position, value_bucket, count FROM placements WHERE board_size = ?1')
      .bind(30)
      .all<PlacementRow>()
    expect(community.results).toHaveLength(30)
    expect(community.results.every(row => row.count === 1)).toBe(true)

    const perDevice = await env.DB.prepare('SELECT position, value_bucket, count FROM device_placements WHERE device_id = ?1 AND board_size = ?2')
      .bind(deviceId, 30)
      .all<PlacementRow>()
    expect(perDevice.results).toHaveLength(30)
    expect(perDevice.results.every(row => row.count === 1)).toBe(true)
  })

  it('accumulates count rather than erroring when a request contains duplicate rows', async () => {
    // Never happens in real traffic (extractPlacements produces one entry
    // per board position, and positions never repeat within a game), but
    // the multi-row INSERT ... ON CONFLICT DO UPDATE relies on SQLite
    // processing VALUES rows one at a time within a single statement,
    // unlike Postgres, which refuses to touch the same row twice in one
    // INSERT. Worth confirming directly rather than assuming.
    const deviceId = 'test-device-dup-rows'
    const placements = [
      { position: 0, valueBucket: 5 },
      { position: 0, valueBucket: 5 },
    ]

    const response = await postPlacements({ boardSize: 20, placements, deviceId })
    expect(response.status).toBe(204)

    const communityRow = await env.DB.prepare('SELECT count FROM placements WHERE board_size = 20 AND position = 0 AND value_bucket = 5').first<{
      count: number
    }>()
    expect(communityRow?.count).toBe(2)

    const deviceRow = await env.DB.prepare('SELECT count FROM device_placements WHERE device_id = ?1 AND board_size = 20 AND position = 0 AND value_bucket = 5')
      .bind(deviceId)
      .first<{ count: number }>()
    expect(deviceRow?.count).toBe(2)
  })

  it('still succeeds without a deviceId (older cached clients)', async () => {
    const placements = Array.from({ length: 25 }, (_, position) => ({ position, valueBucket: position % 10 }))

    const response = await postPlacements({ boardSize: 25, placements })
    expect(response.status).toBe(204)

    const community = await env.DB.prepare('SELECT COUNT(*) as n FROM placements WHERE board_size = 25').first<{ n: number }>()
    expect(community?.n).toBe(25)
  })
})
