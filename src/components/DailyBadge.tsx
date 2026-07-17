import { isStreakActive, type StreakData } from '../game/daily'
import type { DailyResult } from '../hooks/useDailyChallenge'

interface DailyBadgeProps {
  todayResult: DailyResult | null
  streak: StreakData
  today: string
  boardSize: number
  onOpen: () => void
}

export function DailyBadge({ todayResult, streak, today, boardSize, onOpen }: DailyBadgeProps) {
  const active = isStreakActive(streak, today)
  const streakPrefix = active && streak.count >= 2 ? `🔥 ${streak.count} · ` : ''

  if (todayResult) {
    const resultLabel = todayResult.status === 'won' ? `Perfect ${todayResult.positions.length}/${todayResult.positions.length} today!` : `${todayResult.placedCount}/${todayResult.positions.length} today`
    return (
      <button type="button" className="daily-badge daily-badge--done" onClick={onOpen}>
        {streakPrefix}
        {resultLabel}
      </button>
    )
  }

  return (
    <button type="button" className="daily-badge daily-badge--cta" onClick={onOpen}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      {streakPrefix}
      {boardSize}-slot challenge
    </button>
  )
}
