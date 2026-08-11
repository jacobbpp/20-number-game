import { useState } from 'react'
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
  onClose: () => void
}

export function ChallengeScreen({ challenge, playerName, hardMode, onClose }: ChallengeScreenProps) {
  const [typed, setTyped] = useState('')
  const { copied, copy } = useCopyFeedback()

  const { game, record, role, code } = challenge
  const finished = game !== null && (game.status === 'won' || game.status === 'lost')
  const settled = record !== null && isSettled(record)

  // Whose score is whose depends on which end of it you are.
  const mine = record === null ? null : role === 'opponent' ? record.opponentScore : record.challengerScore
  const theirs = record === null ? null : role === 'opponent' ? record.challengerScore : record.opponentScore
  const opponentName = role === 'opponent' ? record?.challengerName : record?.opponentName

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
            <button type="button" className="btn btn--primary" onClick={challenge.start} autoFocus>
              Rematch
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
            <p className="h2h-waiting__desc">Send this code. They get the exact same rolls.</p>
            <p className="h2h-code">{code}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => copy(`Beat this on Order 20: ${game.placedCount} of ${game.positions.length}. Code ${code}`)}
            >
              {copied ? 'Copied' : 'Copy and share'}
            </button>
            <button type="button" className="btn btn--secondary short-reveal__later" onClick={challenge.refresh} disabled={challenge.busy}>
              {challenge.busy ? 'Checking' : 'Check for their answer'}
            </button>
            <p className="h2h-waiting__note">
              Nobody is notified. They will see it when they open the app, and so will you.
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

            <button type="button" className="btn btn--primary" onClick={challenge.start}>
              Start a challenge
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
