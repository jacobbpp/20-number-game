import { ResultGrid } from './ResultGrid'
import { ShareButton } from './ShareButton'
import type { LeaderboardEntry } from '../hooks/useLeaderboard'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface LeaderboardEntryScreenProps {
  entry: LeaderboardEntry
  rank: number
  isYou: boolean
  dailyDate?: string
  onClose: () => void
}

export function LeaderboardEntryScreen({ entry, rank, isYou, dailyDate, onClose }: LeaderboardEntryScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="leaderboard-entry-title" ref={containerRef}>
      <div className="overlay__card">
        <h2 id="leaderboard-entry-title" className="overlay__title">
          #{rank} {entry.name}
        </h2>

        {entry.board ? (
          <>
            <p className="overlay__reason">
              {entry.score} of {entry.board.length} placed
              {entry.endingRoll !== null && ` · ${entry.endingRoll} had nowhere to go`}
            </p>
            <ResultGrid positions={entry.board} />
          </>
        ) : (
          <p className="overlay__reason">This score was saved before boards were recorded, so there's nothing to show here.</p>
        )}

        {isYou && entry.board ? (
          <div className="overlay__actions">
            <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
              Close
            </button>
            <ShareButton
              positions={entry.board}
              placedCount={entry.score}
              won={entry.score === entry.board.length}
              dailyDate={dailyDate}
            />
          </div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
            Close
          </button>
        )}
      </div>
    </div>
  )
}
