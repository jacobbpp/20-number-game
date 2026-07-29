import { useCallback } from 'react'
import { API_BASE } from '../api'
import { applySnapshot, describeSnapshot, gatherSnapshot, parseSnapshot, type SnapshotSummary } from '../game/transfer'

export interface TransferCode {
  code: string
  expiresAt: string
}

export type ClaimOutcome = { ok: true; summary: SnapshotSummary } | { ok: false; reason: 'rejected' | 'offline' }

export function useTransfer() {
  // Sends this device's saved game up and returns the code to read out. The
  // payload is gathered through the allowlist in game/transfer, never straight
  // from localStorage.
  const createTransfer = useCallback(async (): Promise<TransferCode | null> => {
    try {
      const response = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: JSON.stringify(gatherSnapshot(window.localStorage)) }),
      })
      if (!response.ok) return null
      return (await response.json()) as TransferCode
    } catch {
      return null
    }
  }, [])

  const claimTransfer = useCallback(async (code: string): Promise<ClaimOutcome> => {
    let response: Response
    try {
      response = await fetch(`${API_BASE}/transfer/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    } catch {
      // Told apart from a rejected code on purpose: one is worth retrying with
      // the same code, the other is not.
      return { ok: false, reason: 'offline' }
    }

    if (!response.ok) return { ok: false, reason: 'rejected' }

    const body = (await response.json()) as { payload?: unknown }
    if (typeof body.payload !== 'string') return { ok: false, reason: 'rejected' }

    const snapshot = parseSnapshot(body.payload)
    if (snapshot === null) return { ok: false, reason: 'rejected' }

    applySnapshot(snapshot, window.localStorage)
    return { ok: true, summary: describeSnapshot(snapshot) }
  }, [])

  const hasBeenClaimed = useCallback(async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/transfer/status?code=${encodeURIComponent(code)}`)
      if (!response.ok) return false
      return ((await response.json()) as { claimed?: boolean }).claimed === true
    } catch {
      return false
    }
  }, [])

  return { createTransfer, claimTransfer, hasBeenClaimed }
}
