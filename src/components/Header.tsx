import { DailyBadge } from './DailyBadge'
import { RestartButton } from './RestartButton'
import type { StreakData } from '../game/daily'
import type { DailyResult } from '../hooks/useDailyChallenge'

interface HeaderProps {
  bestScore: number
  onRestart: () => void
  onOpenStats: () => void
  showCoachMark: boolean
  todayResult: DailyResult | null
  streak: StreakData
  today: string
  dailyBoardSize: number
  onOpenDaily: () => void
}

export function Header({
  bestScore,
  onRestart,
  onOpenStats,
  showCoachMark,
  todayResult,
  streak,
  today,
  dailyBoardSize,
  onOpenDaily,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__title-block">
        <span className="header__title">Order 20</span>
        <DailyBadge todayResult={todayResult} streak={streak} today={today} boardSize={dailyBoardSize} onOpen={onOpenDaily} />
      </div>
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
        <span className="pill header__best">Best {bestScore}</span>
      </div>
    </header>
  )
}
