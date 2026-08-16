import { useEffect, useState } from 'react'
import { Board } from './Board'
import { RollDisplay } from './RollDisplay'
import { describeOutcome, isChallengeCode, isSettled, normaliseCode, outcomeOf } from '../game/challenge'
import { suggestedPosition } from '../game/hint'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Challenge } from '../hooks/useChallenge'

interface ChallengeScreenProps {
  challenge: Challenge
  playerName: string
  hardMode: boolean
  // Everybody this player has a daily record against, most-played first.
  opponents: string[]
  // Preselected when the screen was opened from a Challenge button that
  // already had somebody in mind.
  initialOpponent: string | null
  onClose: () => void
}

export function ChallengeScreen({
  challenge,
  playerName,
  hardMode,
  opponents,
  initialOpponent,
  onClose,
}: ChallengeScreenProps) {
  const [typed, setTyped] = useState('')
  // Null is the open challenge: whoever answers first takes it.
  const [invited, setInvited] = useState<string | null>(initialOpponent)
  const { copied, copy } = useCopyFeedback()

  const { game, record, role, code } = challenge
  const finished = game !== null && (game.status === 'won' || game.status === 'lost')
  const settled = record !== null && isSettled(record)

  // Whose score is whose depends on which end of it you are.
  const mine = record === null ? null : role === 'opponent' ? record.opponentScore : record.challengerScore
  const theirs = record === null ? null : role === 'opponent' ? record.challengerScore : record.opponentScore
  const opponentName = role === 'opponent' ? record?.challengerName : record?.opponentName

  // Reading the result is what clears the dot on the header, so it clears by
  // being looked at rather than by being dismissed.
  useEffect(() => {
    if (settled) challenge.markSeen()
  }, [settled, challenge])

  const suggestion =
    game && game.currentRoll !== null ? suggestedPosition(game.positions, game.currentRoll, game.validPositions) : null

  return (
    <div className="short-screen">
      <div className="short-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="short-screen__title">Head to head</span>
        {code && <span className="short-screen__record">{code}</span>}
      </div>

      <div className="short-screen__content">
        {/* A challenge is recorded against a leaderboard name, so there has to
            be one. Everybody who has ever made a board already has. */}
        {!playerName ? (
          <div className="reminder-gate">
            <p className="reminder-gate__title">You need a name first</p>
            <p className="reminder-gate__body">
              A challenge is saved against your leaderboard name. Finish a game good enough for the leaderboard, save a
              name, and this opens up.
            </p>
          </div>
        ) : settled && mine !== null && theirs !== null ? (
          <div className={`h2h-result h2h-result--${outcomeOf(mine, theirs)}`}>
            <p className="h2h-result__eyebrow">HEAD TO HEAD</p>
            <div className="h2h-result__scores">
              <div className={`h2h-side${mine >= theirs ? ' h2h-side--ahead' : ''}`}>
                <p className="h2h-side__who">You</p>
                <p className="h2h-side__score">{mine}</p>
              </div>
              <div className={`h2h-side${theirs >= mine ? ' h2h-side--ahead' : ''}`}>
                <p className="h2h-side__who">{opponentName ?? 'Them'}</p>
                <p className="h2h-side__score">{theirs}</p>
              </div>
            </div>
            <p className="h2h-result__desc">{describeOutcome(outcomeOf(mine, theirs), mine, theirs, record.boardSize)}</p>
            {/* A rematch goes back to the same person rather than out to
                anybody, which is what asking for one means. */}
            <button type="button" className="btn btn--primary" onClick={() => challenge.start(opponentName ?? null)} autoFocus>
              {opponentName ? `Rematch ${opponentName}` : 'Rematch'}
            </button>
            <button type="button" className="btn btn--secondary short-reveal__later" onClick={challenge.clear}>
              Done
            </button>
          </div>
        ) : finished && role === 'challenger' ? (
          <div className="h2h-waiting">
            <p className="h2h-waiting__eyebrow">YOUR GO</p>
            <p className="h2h-waiting__score">
              {game.placedCount} of {game.positions.length}
            </p>
            <p className="h2h-waiting__desc">
              {challenge.invitedName
                ? `Send this to ${challenge.invitedName}. They get the exact same rolls, and only they can answer it.`
                : 'Send this code. They get the exact same rolls.'}
            </p>
            <p className="h2h-code">{code}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() =>
                copy(
                  `${challenge.invitedName ? `${challenge.invitedName}, beat` : 'Beat'} this on Order 20: ${game.placedCount} of ${game.positions.length}. Code ${code}`,
                )
              }
            >
              {copied ? 'Copied' : 'Copy and share'}
            </button>
            <button type="button" className="btn btn--secondary short-reveal__later" onClick={challenge.refresh} disabled={challenge.busy}>
              {challenge.busy ? 'Checking' : 'Check for their answer'}
            </button>
            <p className="h2h-waiting__note">
              Nobody is notified. {challenge.invitedName ?? 'They'} will see it when they open the app, and so will
              you.
            </p>
          </div>
        ) : finished ? (
          <div className="h2h-waiting">
            <p className="h2h-waiting__eyebrow">YOUR GO</p>
            <p className="h2h-waiting__score">
              {game.placedCount} of {game.positions.length}
            </p>
            <p className="h2h-waiting__desc">Saved. Fetching how they did.</p>
            <button type="button" className="btn btn--primary" onClick={challenge.refresh} disabled={challenge.busy}>
              {challenge.busy ? 'Checking' : 'See the result'}
            </button>
          </div>
        ) : game ? (
          <>
            <RollDisplay currentRoll={game.currentRoll} placedCount={game.placedCount} total={game.positions.length} />
            <Board
              positions={game.positions}
              validPositions={game.validPositions}
              hardMode={hardMode}
              suggestedPosition={suggestion}
              onSelect={challenge.select}
            />
          </>
        ) : (
          <div className="h2h-intro">
            <p className="h2h-intro__title">One board, two of you</p>
            <p className="h2h-intro__body">
              You play first. Whoever you send the code to gets the identical rolls, and neither of you sees the other's
              score until you have both finished.
            </p>

            {/* Only shown to somebody who has a daily record against other
                people, because those names are where this list comes from.
                Anyone stays first, and stays the default, so the open
                challenge is never buried behind picking a person. */}
            {opponents.length > 0 && (
              <>
                <p className="h2h-pick__label">WHO IS IT FOR</p>
                <div className="h2h-pick" role="group" aria-label="Who the challenge is for">
                  <button
                    type="button"
                    className={`h2h-pick__name${invited === null ? ' h2h-pick__name--on' : ''}`}
                    aria-pressed={invited === null}
                    onClick={() => setInvited(null)}
                  >
                    Anyone
                  </button>
                  {opponents.map(name => (
                    <button
                      key={name}
                      type="button"
                      className={`h2h-pick__name${invited === name ? ' h2h-pick__name--on' : ''}`}
                      aria-pressed={invited === name}
                      onClick={() => setInvited(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button type="button" className="btn btn--primary" onClick={() => challenge.start(invited)}>
              {invited ? `Challenge ${invited}` : 'Start a challenge'}
            </button>

            <p className="h2h-intro__or">or answer one</p>

            <input
              className="transfer-input"
              value={typed}
              onChange={event => setTyped(normaliseCode(event.target.value).slice(0, 6))}
              placeholder="CODE"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Challenge code"
            />
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!isChallengeCode(typed) || challenge.busy}
              onClick={() => void challenge.open(typed)}
            >
              {challenge.busy ? 'Looking' : 'Play their board'}
            </button>

            {challenge.error && <p className="reminder-error">{challenge.error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
