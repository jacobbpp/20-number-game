interface ControlsProps {
  canRoll: boolean
  onRoll: () => void
  onRestart: () => void
  onNewGame: () => void
}

export function Controls({ canRoll, onRoll, onRestart, onNewGame }: ControlsProps) {
  return (
    <div className="controls">
      <div className="controls__row">
        <button type="button" className="btn btn--primary" onClick={onRoll} disabled={!canRoll}>
          Roll
        </button>
        <button type="button" className="btn btn--secondary" onClick={onRestart}>
          Restart
        </button>
      </div>
      <button type="button" className="btn btn--ghost" onClick={onNewGame}>
        New game
      </button>
    </div>
  )
}
