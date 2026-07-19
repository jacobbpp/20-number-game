import { LeaderboardPrompt } from './LeaderboardPrompt'
import { ResultGrid } from './ResultGrid'
import { ShareButton } from './ShareButton'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { LeaderboardWindow } from '../hooks/useLeaderboard'

interface WinScreenProps {
  positions: (number | null)[]
  onNewGame: () => void
  leaderboardWindows: LeaderboardWindow[] | null
  rememberedName: string
  onSaveScore: (name: string) => void
  onSkipScore: () => void
}

export function WinScreen({ positions, onNewGame, leaderboardWindows, rememberedName, onSaveScore, onSkipScore }: WinScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="win-title" ref={containerRef}>
      <div className="overlay__card overlay__card--win">
        <h2 id="win-title" className="overlay__title">
          Perfect order!
        </h2>
        <p className="overlay__reason">All {positions.length} positions filled in ascending order.</p>
        <ResultGrid positions={positions} />
        {leaderboardWindows && (
          <LeaderboardPrompt windows={leaderboardWindows} rememberedName={rememberedName} onSave={onSaveScore} onSkip={onSkipScore} />
        )}
        <div className="overlay__actions">
          <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus={!leaderboardWindows}>
            New game
          </button>
          <ShareButton positions={positions} placedCount={positions.length} won />
        </div>
      </div>
    </div>
  )
}
