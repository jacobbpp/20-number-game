import { useEffect, useState } from 'react'
import type { LeaderboardEntry, LeaderboardWindow } from '../hooks/useLeaderboard'
import { BOARD_SIZE } from '../game/types'

const WINDOWS: { key: LeaderboardWindow; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All-time' },
]

const WINDOW_CAPTION: Record<LeaderboardWindow, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  all: 'All time',
}

interface LeaderboardScreenProps {
  rememberedName: string
  fetchLeaderboard: (boardSize: number, window: LeaderboardWindow) => Promise<LeaderboardEntry[]>
  onClose: () => void
}

export function LeaderboardScreen({ rememberedName, fetchLeaderboard, onClose }: LeaderboardScreenProps) {
  const [window, setWindow] = useState<LeaderboardWindow>('day')
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    fetchLeaderboard(BOARD_SIZE, window).then(result => {
      if (!cancelled) setEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [fetchLeaderboard, window])

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to stats">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">Leaderboard</span>
      </div>

      <div className="heatmap-toggle" role="group" aria-label="Leaderboard time range">
        {WINDOWS.map(w => (
          <button
            key={w.key}
            type="button"
            className={`heatmap-toggle__option${window === w.key ? ' heatmap-toggle__option--active' : ''}`}
            aria-pressed={window === w.key}
            onClick={() => setWindow(w.key)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="stats-screen__body">
        {entries === null ? (
          <p className="stats-screen__empty">Loading leaderboard.</p>
        ) : entries.length === 0 ? (
          <p className="stats-screen__empty">No scores yet. Be the first.</p>
        ) : (
          <ol className="daily-history__list">
            {entries.map((entry, index) => (
              <li
                key={`${entry.name}-${index}`}
                className={entry.name === rememberedName ? 'daily-history__row leaderboard-row leaderboard-row--you' : 'daily-history__row leaderboard-row'}
              >
                <span className="leaderboard-row__rank">{index + 1}</span>
                <span className="leaderboard-row__name">
                  {entry.name}
                  {entry.name === rememberedName ? ' · you' : ''}
                </span>
                <span className="leaderboard-row__score">
                  {entry.score}/{BOARD_SIZE}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="stats-screen__caption" style={{ textAlign: 'center' }}>
          {WINDOW_CAPTION[window]} · top {entries?.length ?? 10}
        </p>
      </div>
    </div>
  )
}
