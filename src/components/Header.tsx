import { RestartButton } from './RestartButton'
import type { DailyResult } from '../hooks/useDailyChallenge'

interface HeaderProps {
  bestScore: number
  onRestart: () => void
  onOpenStats: () => void
  showCoachMark: boolean
  todayResult: DailyResult | null
  dailyBoardSize: number
  onOpenDaily: () => void
  onOpenSettings: () => void
  onOpenBestRun: () => void
}

export function Header({
  bestScore,
  onRestart,
  onOpenStats,
  showCoachMark,
  todayResult,
  dailyBoardSize,
  onOpenDaily,
  onOpenSettings,
  onOpenBestRun,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__actions">
        <div className="coach-anchor">
          <RestartButton onRestart={onRestart} />
          {showCoachMark && <span className="coach-tip">Restart</span>}
        </div>
        <div className="coach-anchor">
          <button type="button" className="icon-btn" onClick={onOpenStats} aria-label="View stats">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20V10" />
              <path d="M12 20V4" />
              <path d="M20 20V14" />
            </svg>
          </button>
          {showCoachMark && <span className="coach-tip">Stats</span>}
        </div>
        <button
          type="button"
          className={todayResult ? 'icon-btn' : 'icon-btn icon-btn--ring'}
          onClick={onOpenDaily}
          aria-label={todayResult ? "Today's challenge, completed" : `Today's ${dailyBoardSize}-slot challenge`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
      <button type="button" className="pill header__best" onClick={onOpenBestRun}>
        Best {bestScore}
      </button>
    </header>
  )
}
