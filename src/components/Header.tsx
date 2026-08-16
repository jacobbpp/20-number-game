import { RestartButton } from './RestartButton'
import type { DailyResult } from '../hooks/useDailyChallenge'
import tommyHead from '../brand/assets/tommy-head-orange.png'

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
  onOpenLeaderboard: () => void
  onOpenChallenge: () => void
  // Somebody has answered a challenge of yours and you haven't seen it yet.
  // Nothing is pushed, so this dot is the only way anybody finds out without
  // going looking.
  challengeWaiting: boolean
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
  onOpenLeaderboard,
  onOpenChallenge,
  challengeWaiting,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__brand" aria-hidden="true">
        <span className="brand-badge">
          <img src={tommyHead} alt="" className="brand-badge__img" />
        </span>
        <span className="brand-wordmark">
          <span className="brand-wordmark__symbol">~/</span>
          <span className="brand-wordmark__name">order-20</span>
        </span>
      </div>
      <div className="header__row">
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
          <button type="button" className="icon-btn" onClick={onOpenLeaderboard} aria-label="Leaderboard">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10" />
              <path d="M17 4v8a5 5 0 0 1-10 0V4" />
              <path d="M5 4H3v2a4 4 0 0 0 4 4" />
              <path d="M19 4h2v2a4 4 0 0 1-4 4" />
            </svg>
          </button>
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
          {/* Two blades crossed. It sits next to the daily rather than inside
              Stats because a challenge is something somebody is waiting on,
              not a number to go and look up. */}
          <button
            type="button"
            className={challengeWaiting ? 'icon-btn icon-btn--dot' : 'icon-btn'}
            onClick={onOpenChallenge}
            aria-label={challengeWaiting ? 'Head to head, an answer is waiting' : 'Head to head'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8h11" />
              <path d="M11 5l3 3-3 3" />
              <path d="M21 16H10" />
              <path d="M13 13l-3 3 3 3" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
      {/* Off the icon row: six buttons and a pill do not fit a 320px screen,
          and the pill was the part that went off the edge. It reads as a
          statistic rather than an action anyway. */}
      <button type="button" className="header__best" onClick={onOpenBestRun}>
        Best <b>{bestScore}</b>
      </button>
    </header>
  )
}
