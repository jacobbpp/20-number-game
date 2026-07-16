interface HeaderProps {
  bestScore: number
  onRestart: () => void
  onOpenStats: () => void
}

export function Header({ bestScore, onRestart, onOpenStats }: HeaderProps) {
  return (
    <header className="header">
      <span className="header__title">Order 20</span>
      <div className="header__actions">
        <button type="button" className="icon-btn" onClick={onRestart} aria-label="Restart game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
        <button type="button" className="icon-btn" onClick={onOpenStats} aria-label="View stats">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20V10" />
            <path d="M12 20V4" />
            <path d="M20 20V14" />
          </svg>
        </button>
        <span className="pill header__best">Best {bestScore}</span>
      </div>
    </header>
  )
}
