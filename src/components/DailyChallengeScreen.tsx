import { useState } from 'react'
import { Board } from './Board'
import { ResultGrid } from './ResultGrid'
import { RollDisplay } from './RollDisplay'
import { ShareButton } from './ShareButton'
import { isStreakActive, type StreakData } from '../game/daily'
import { buildStreakShareText, formatDailyDateLabel } from '../game/share'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { GameState } from '../game/types'
import type { DailyResult } from '../hooks/useDailyChallenge'
import type { Theme } from '../hooks/useTheme'
import { vibrate } from '../utils/haptics'
import { playSound } from '../utils/sound'

interface DailyChallengeScreenProps {
  dailyState: GameState
  todayResult: DailyResult | null
  streak: StreakData
  history: DailyResult[]
  today: string
  hardMode: boolean
  theme: Theme
  onSelect: (index: number) => void
  onClose: () => void
}

export function DailyChallengeScreen({
  dailyState,
  todayResult,
  streak,
  history,
  today,
  hardMode,
  theme,
  onSelect,
  onClose,
}: DailyChallengeScreenProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const { copied: streakCopied, copy: copyStreak } = useCopyFeedback()
  const active = isStreakActive(streak, today)
  // Today's own entry is already shown in the recap above, so the list
  // below only needs the days before it.
  const pastHistory = history.filter(entry => entry.date !== today)

  const handleShareStreak = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const didCopy = await copyStreak(buildStreakShareText(streak, url))
    if (!didCopy) return

    vibrate('copy')
    playSound('copy')
  }

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
          <div className="daily-screen__recap-content">
            <div className="daily-screen__card">
              <p className="daily-screen__headline">
                {todayResult.status === 'won'
                  ? `Perfect ${todayResult.positions.length}/${todayResult.positions.length} today!`
                  : `${todayResult.placedCount} of ${todayResult.positions.length} today`}
              </p>
              <ResultGrid positions={todayResult.positions} />
              {active && streak.count >= 2 && (
                <button type="button" className="daily-screen__streak" onClick={handleShareStreak}>
                  {streakCopied ? (
                    'Copied!'
                  ) : (
                    <>
                      {`🔥 ${streak.count} day streak`}
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                        <path d="M16 6l-4-4-4 4" />
                        <path d="M12 2v13" />
                      </svg>
                    </>
                  )}
                </button>
              )}
              <p className="daily-screen__tomorrow">Come back tomorrow for the next one.</p>
              <ShareButton
                positions={todayResult.positions}
                placedCount={todayResult.placedCount}
                won={todayResult.status === 'won'}
                dailyDate={todayResult.date}
                theme={theme}
              />
            </div>

            {pastHistory.length > 0 && (
              <div className="daily-history">
                <button
                  type="button"
                  className="daily-history__toggle"
                  aria-expanded={isHistoryOpen}
                  onClick={() => setIsHistoryOpen(open => !open)}
                >
                  {isHistoryOpen ? 'Hide history' : 'View history'}
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={isHistoryOpen ? 'daily-history__chevron daily-history__chevron--open' : 'daily-history__chevron'}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {isHistoryOpen && (
                  <ul className="daily-history__list">
                    {pastHistory.map(entry => {
                      const size = entry.positions.length
                      const won = entry.status === 'won'
                      return (
                        <li key={entry.date} className="daily-history__row">
                          <span className="daily-history__date">{formatDailyDateLabel(entry.date)}</span>
                          <span className="daily-history__size">{size}</span>
                          <span className={won ? 'daily-history__score daily-history__score--won' : 'daily-history__score'}>
                            {entry.placedCount}/{size} {won ? '✓' : '✕'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <RollDisplay
            currentRoll={dailyState.currentRoll}
            placedCount={dailyState.placedCount}
            total={dailyState.positions.length}
          />
          <Board
            positions={dailyState.positions}
            validPositions={dailyState.validPositions}
            hardMode={hardMode}
            // Daily board sizes vary day to day, so there's no shared
            // matrix to draw a "usual spot" suggestion from the way free
            // play has.
            suggestedPosition={null}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  )
}
