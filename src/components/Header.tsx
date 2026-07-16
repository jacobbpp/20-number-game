interface HeaderProps {
  bestScore: number
  onRestart: () => void
}

export function Header({ bestScore, onRestart }: HeaderProps) {
  return (
    <header className="header">
      <span className="header__title">Order 20</span>
      <div className="header__actions">
        <button type="button" className="pill header__restart" onClick={onRestart}>
          Restart
        </button>
        <span className="pill header__best">Best {bestScore}</span>
      </div>
    </header>
  )
}
