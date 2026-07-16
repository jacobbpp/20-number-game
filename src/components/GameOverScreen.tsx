interface GameOverScreenProps {
  reason: string
  placedCount: number
  bestScore: number
  onNewGame: () => void
}

export function GameOverScreen({ reason, placedCount, bestScore, onNewGame }: GameOverScreenProps) {
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="gameover-title">
      <div className="overlay__card overlay__card--lose">
        <h2 id="gameover-title" className="overlay__title">
          Game over
        </h2>
        <p className="overlay__reason">{reason}</p>
        <p className="overlay__score">
          {placedCount} of 20 placed
          {placedCount >= bestScore && placedCount > 0 && ' · new best!'}
        </p>
        <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus>
          New game
        </button>
      </div>
    </div>
  )
}
