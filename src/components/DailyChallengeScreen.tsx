import { Board } from './Board'
import { ResultGrid } from './ResultGrid'
import { RollDisplay } from './RollDisplay'
import { ShareButton } from './ShareButton'
import { getLocalDateString, isStreakActive, type StreakData } from '../game/daily'
import type { GameState } from '../game/types'
import type { DailyResult } from '../hooks/useDailyChallenge'

interface DailyChallengeScreenProps {
  dailyState: GameState
  todayResult: DailyResult | null
  streak: StreakData
  onSelect: (index: number) => void
  onClose: () => void
}

export function DailyChallengeScreen({ dailyState, todayResult, streak, onSelect, onClose }: DailyChallengeScreenProps) {
  const active = isStreakActive(streak, getLocalDateString())

  return (
    <div className="daily-screen">
      <div className="daily-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="daily-screen__title">Today's challenge</span>
      </div>

      {todayResult ? (
        <div className="daily-screen__recap">
          <div className="daily-screen__card">
            <p className="daily-screen__headline">
              {todayResult.status === 'won'
                ? 'Perfect today!'
                : `${todayResult.placedCount} of ${todayResult.positions.length} today`}
            </p>
            <ResultGrid positions={todayResult.positions} />
            {active && streak.count >= 2 && <p className="daily-screen__streak">🔥 {streak.count} day streak</p>}
            <p className="daily-screen__tomorrow">Come back tomorrow for the next one.</p>
            <ShareButton
              positions={todayResult.positions}
              placedCount={todayResult.placedCount}
              won={todayResult.status === 'won'}
              dailyDate={todayResult.date}
            />
          </div>
        </div>
      ) : (
        <>
          <RollDisplay
            currentRoll={dailyState.currentRoll}
            placedCount={dailyState.placedCount}
            total={dailyState.positions.length}
          />
          <Board positions={dailyState.positions} validPositions={dailyState.validPositions} onSelect={onSelect} />
        </>
      )}
    </div>
  )
}
