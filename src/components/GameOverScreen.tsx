import { ResultGrid } from './ResultGrid'
import { ShareButton } from './ShareButton'
import type { ResultBadge } from '../game/types'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface GameOverScreenProps {
  reason: string
  placedCount: number
  resultBadge: ResultBadge
  positions: (number | null)[]
  onNewGame: () => void
}

export function GameOverScreen({ reason, placedCount, resultBadge, positions, onNewGame }: GameOverScreenProps) {
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
          {placedCount} of 20 placed
          {resultBadge === 'new-best' && ' · new best!'}
          {resultBadge === 'tied-best' && ' · matched your best!'}
        </p>
        <div className="overlay__actions">
          <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus>
            New game
          </button>
          <ShareButton positions={positions} placedCount={placedCount} won={false} />
        </div>
      </div>
    </div>
  )
}
