interface WinScreenProps {
  onNewGame: () => void
}

export function WinScreen({ onNewGame }: WinScreenProps) {
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="win-title">
      <div className="overlay__card overlay__card--win">
        <h2 id="win-title" className="overlay__title">
          Perfect order!
        </h2>
        <p className="overlay__reason">All 20 positions filled in ascending order.</p>
        <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus>
          New game
        </button>
      </div>
    </div>
  )
}
