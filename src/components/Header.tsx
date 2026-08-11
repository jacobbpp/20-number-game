import { RestartButton } from './RestartButton'
import type { DailyResult } from '../hooks/useDailyChallenge'
import { useLongPress } from '../hooks/useLongPress'
import tommyHead from '../brand/assets/tommy-head-orange.png'

// Long enough that it cannot be hit by a clumsy tap, short enough that anyone
// who holds it wondering "does this do anything" gets an answer.
const SHORT_BOARD_HOLD_MS = 3000

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
  // Order 6 hides behind the wordmark. Nothing here names it: it is found by
  // holding onto the one thing on screen that is obviously the app's own
  // badge. See game/shortBoard.ts.
  shortBoardUnlocked: boolean
  onShortBoardPressStart: () => void
  onShortBoardFound: () => void
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
  shortBoardUnlocked,
  onShortBoardPressStart,
  onShortBoardFound,
}: HeaderProps) {
  const press = useLongPress({
    durationMs: SHORT_BOARD_HOLD_MS,
    onStart: onShortBoardPressStart,
    onComplete: onShortBoardFound,
  })
  // Once it has been found there is nothing left to find, and the wordmark
  // goes back to being a wordmark.
  const eggHandlers = shortBoardUnlocked ? {} : press.handlers
  const eggProgress = shortBoardUnlocked ? 0 : press.progress

  return (
    <header className="header">
      <div className="header__brand" aria-hidden="true">
        <span className="brand-badge">
          <img src={tommyHead} alt="" className="brand-badge__img" />
        </span>
        {/* Deliberately not a button and not focusable. Giving this a name
            that hinted at what it does would hand it to everybody at once,
            which is the opposite of the point. It reads as decoration to a
            screen reader, exactly as it did before. */}
        <span
          className="brand-wordmark brand-wordmark--egg"
          style={eggProgress > 0 ? { ['--egg-progress' as string]: `${eggProgress * 100}%` } : undefined}
          {...eggHandlers}
        >
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
      </div>
    </header>
  )
}
