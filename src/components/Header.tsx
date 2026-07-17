import { RestartButton } from './RestartButton'

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
        <RestartButton onRestart={onRestart} />
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
