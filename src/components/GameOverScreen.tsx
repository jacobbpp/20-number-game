import { LeaderboardPrompt } from './LeaderboardPrompt'
import { ResultGrid } from './ResultGrid'
import { ShareButton } from './ShareButton'
import type { ResultBadge } from '../game/types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { LeaderboardWindow } from '../hooks/useLeaderboard'

interface GameOverScreenProps {
  reason: string
  placedCount: number
  bestScore: number
  resultBadge: ResultBadge
  positions: (number | null)[]
  onNewGame: () => void
  leaderboardWindows: LeaderboardWindow[] | null
  rememberedName: string
  onSaveScore: (name: string) => void
  onSkipScore: () => void
}

export function GameOverScreen({
  reason,
  placedCount,
  bestScore,
  resultBadge,
  positions,
  onNewGame,
  leaderboardWindows,
  rememberedName,
  onSaveScore,
  onSkipScore,
}: GameOverScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="gameover-title" ref={containerRef}>
      <div className="overlay__card overlay__card--lose">
        <h2 id="gameover-title" className="overlay__title">
          Game over
        </h2>
        <p className="overlay__reason">{reason}</p>
        <ResultGrid positions={positions} />
        <p className="overlay__score">
          {placedCount} of {positions.length} placed
          {resultBadge === 'new-best' && ' · new best!'}
          {resultBadge === 'tied-best' && ' · matched your best!'}
          {resultBadge === null && bestScore > placedCount && ` · ${bestScore - placedCount} away from your record`}
        </p>
        {leaderboardWindows && (
          <LeaderboardPrompt windows={leaderboardWindows} rememberedName={rememberedName} onSave={onSaveScore} onSkip={onSkipScore} />
        )}
        <div className="overlay__actions">
          <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus={!leaderboardWindows}>
            New game
          </button>
          <ShareButton positions={positions} placedCount={placedCount} won={false} />
        </div>
      </div>
    </div>
  )
}
