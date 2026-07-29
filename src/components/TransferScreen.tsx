import { useCallback, useEffect, useRef, useState } from 'react'
import { TransferGuide } from './TransferGuide'
import type { SnapshotSummary } from '../game/transfer'
import { useTransfer, type TransferCode } from '../hooks/useTransfer'
import { clearAllData } from '../utils/resetData'

type Stage = 'choose' | 'sending' | 'sent' | 'receiving' | 'received'

const POLL_INTERVAL_MS = 3000

interface TransferScreenProps {
  onClose: () => void
}

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function TransferScreen({ onClose }: TransferScreenProps) {
  const { createTransfer, claimTransfer, hasBeenClaimed } = useTransfer()
  const [stage, setStage] = useState<Stage>('choose')
  const [transfer, setTransfer] = useState<TransferCode | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [entered, setEntered] = useState('')
  const [claimError, setClaimError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<SnapshotSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startSending = useCallback(async () => {
    setStage('sending')
    setBusy(true)
    const created = await createTransfer()
    setBusy(false)

    if (!created) {
      setClaimError("Couldn't reach the server. Check your connection and try again.")
      setStage('choose')
      return
    }

    setTransfer(created)
    setRemainingMs(Date.parse(created.expiresAt) - Date.now())
  }, [createTransfer])

  // Someone arriving here has a code in hand and is ready to type it, so put
  // the caret where they are already looking.
  useEffect(() => {
    if (stage === 'receiving') inputRef.current?.focus()
  }, [stage])

  // Countdown, plus a poll so this device notices the moment the other one
  // collects the code and can offer to clear itself.
  useEffect(() => {
    if (stage !== 'sending' || !transfer) return

    const expiresAt = Date.parse(transfer.expiresAt)
    let cancelled = false

    const tick = setInterval(() => {
      setRemainingMs(expiresAt - Date.now())
    }, 1000)

    const poll = setInterval(async () => {
      if (await hasBeenClaimed(transfer.code)) {
        if (!cancelled) setStage('sent')
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [stage, transfer, hasBeenClaimed])

  const submitCode = async () => {
    setBusy(true)
    setClaimError(null)
    const outcome = await claimTransfer(entered)
    setBusy(false)

    if (!outcome.ok) {
      setClaimError(
        outcome.reason === 'offline'
          ? "Couldn't reach the server. Check your connection and try the same code again."
          : 'That code has expired or has already been used. Make a new one on your old device.',
      )
      return
    }

    setSummary(outcome.summary)
    setStage('received')
  }

  const heading =
    stage === 'choose'
      ? 'Move my game'
      : stage === 'sending'
        ? 'Your code'
        : stage === 'sent'
          ? 'Moved'
          : stage === 'receiving'
            ? 'Enter the code'
            : // Not "Your game is here" — the body already says that, and
              // repeating it in the header just reads as a stutter.
              'All done'

  const handleBack = () => {
    if (stage === 'choose') onClose()
    else if (stage === 'received') onClose()
    else setStage('choose')
  }

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label={stage === 'choose' ? 'Back to settings' : 'Back'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">{heading}</span>
      </div>

      <div className="stats-screen__body">
        {stage === 'choose' && (
          <>
            <p className="stats-screen__caption">Which device are you holding right now?</p>

            <button type="button" className="transfer-choice" onClick={startSending}>
              <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
                <rect x="11" y="4" width="20" height="34" rx="4" fill="none" stroke="var(--cta)" strokeWidth="1.8" />
                <rect x="14" y="9" width="14" height="3" rx="1.5" fill="var(--cta)" opacity="0.85" />
                <rect x="14" y="14" width="10" height="3" rx="1.5" fill="var(--cta)" opacity="0.55" />
                <rect x="14" y="19" width="12" height="3" rx="1.5" fill="var(--cta)" opacity="0.4" />
                <circle cx="21" cy="31" r="3.4" fill="none" stroke="var(--cta)" strokeWidth="1.5" />
              </svg>
              <span className="transfer-choice__txt">
                <b>The one with my game</b>
                <span>Gives you a code to type in</span>
              </span>
            </button>

            <button
              type="button"
              className="transfer-choice"
              onClick={() => {
                setClaimError(null)
                setEntered('')
                setStage('receiving')
              }}
            >
              <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
                <rect x="11" y="4" width="20" height="34" rx="4" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="3 2.5" />
                <path d="M21 15v12M15 21h12" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="transfer-choice__txt">
                <b>The new, empty one</b>
                <span>Asks you for the code</span>
              </span>
            </button>

            {claimError && <p className="transfer-error">{claimError}</p>}

            <p className="transfer-guide__label">How it works</p>
            <TransferGuide />

            <p className="stats-screen__caption transfer-note">
              This moves your game once. It does not keep two devices in step afterwards, so once it lands, carry on playing there.
            </p>
          </>
        )}

        {stage === 'sending' && (
          <>
            {busy && <p className="stats-screen__caption">Making your code.</p>}
            {transfer && (
              <>
                <div className="transfer-codebox">
                  <p className="transfer-codebox__lbl">Type this on the new device</p>
                  <p className="transfer-code">{transfer.code}</p>
                  <p className="transfer-codebox__timer">
                    {remainingMs > 0 ? `Expires in ${formatCountdown(remainingMs)}` : 'This code has expired.'}
                  </p>
                </div>

                <div className="insight-panel">
                  <p className="insight-panel__label">What travels across</p>
                  <ul className="transfer-list">
                    <li>Best score and every stat</li>
                    <li>Daily streak and history</li>
                    <li>Achievements you have unlocked</li>
                    <li>Your leaderboard name</li>
                  </ul>
                </div>

                <p className="stats-screen__caption">Keep this screen open until the other device says it is done.</p>
              </>
            )}
          </>
        )}

        {stage === 'sent' && (
          <>
            <div className="transfer-done">
              <div className="transfer-done__tick" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 26 26">
                  <path d="M6 13.5l4.5 4.5L20 8.5" fill="none" stroke="var(--win)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="transfer-done__title">Your game moved</p>
              <p className="transfer-done__sub">The other device has it now. This one still has its own copy.</p>
            </div>

            <p className="stats-screen__caption transfer-note">
              You can clear this device so there is only one copy, or leave it exactly as it is. Nothing is deleted unless you choose to.
            </p>

            <button
              type="button"
              className="btn btn--danger-outline transfer-action"
              onClick={() => {
                clearAllData()
                window.location.reload()
              }}
            >
              Clear this device
            </button>
            <button type="button" className="btn btn--secondary transfer-action" onClick={onClose}>
              Leave it as it is
            </button>
          </>
        )}

        {stage === 'receiving' && (
          <>
            <p className="stats-screen__caption">Six characters, from the other device's screen.</p>

            <label className="transfer-input__label" htmlFor="transfer-code-input">
              Transfer code
            </label>
            <input
              id="transfer-code-input"
              ref={inputRef}
              className="transfer-input"
              value={entered}
              onChange={event => {
                setClaimError(null)
                setEntered(event.target.value.toUpperCase().slice(0, 6))
              }}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="K7M2QP"
              aria-describedby="transfer-overwrite-warning"
            />

            {claimError && <p className="transfer-error">{claimError}</p>}

            <button type="button" className="btn btn--primary transfer-action" disabled={entered.length !== 6 || busy} onClick={submitCode}>
              {busy ? 'Bringing it across.' : 'Bring my game here'}
            </button>

            <p className="stats-screen__caption transfer-note" id="transfer-overwrite-warning">
              This replaces whatever is on this device. If you have already played here, that gets written over.
            </p>
          </>
        )}

        {stage === 'received' && summary && (
          <>
            <div className="transfer-done">
              <div className="transfer-done__tick" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 26 26">
                  <path d="M6 13.5l4.5 4.5L20 8.5" fill="none" stroke="var(--win)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="transfer-done__title">Your game is here</p>
              <p className="transfer-done__sub">
                {[
                  summary.bestScore !== null ? `Best score ${summary.bestScore}` : null,
                  summary.streakDays ? `a ${summary.streakDays} day streak` : null,
                  summary.achievements ? `${summary.achievements} achievements` : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Everything saved on the other device'}{' '}
                came across.
              </p>
            </div>

            <p className="stats-screen__caption transfer-note">
              That code has now been used up. Carry on playing on this device, and stop using the old one.
            </p>

            <button
              type="button"
              className="btn btn--primary transfer-action"
              onClick={() => {
                // A full reload is the honest way to pick the new data up:
                // every hook read its slice of storage once, on mount.
                window.location.reload()
              }}
            >
              Start playing
            </button>
          </>
        )}
      </div>
    </div>
  )
}
