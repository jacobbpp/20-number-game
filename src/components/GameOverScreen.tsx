import type { ResultBadge } from '../game/types'

interface GameOverScreenProps {
  reason: string
  placedCount: number
  resultBadge: ResultBadge
  onNewGame: () => void
}

export function GameOverScreen({ reason, placedCount, resultBadge, onNewGame }: GameOverScreenProps) {
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="gameover-title">
      <div className="overlay__card overlay__card--lose">
        <h2 id="gameover-title" className="overlay__title">
          Game over
        </h2>
        <p className="overlay__reason">{reason}</p>
        <p className="overlay__score">
          {placedCount} of 20 placed
          {resultBadge === 'new-best' && ' · new best!'}
          {resultBadge === 'tied-best' && ' · matched your best!'}
        </p>
        <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus>
          New game
        </button>
      </div>
    </div>
  )
}
