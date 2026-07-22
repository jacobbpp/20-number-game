import { useEffect, useState } from 'react'
import type { LeaderboardEntry, LeaderboardWindow, StreakEntry } from '../hooks/useLeaderboard'
import { BOARD_SIZE } from '../game/types'
import { LeaderboardEntryScreen } from './LeaderboardEntryScreen'

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

type Mode = 'freeplay' | 'daily' | 'streaks'

interface LeaderboardScreenProps {
  rememberedName: string
  fetchLeaderboard: (boardSize: number, window: LeaderboardWindow) => Promise<LeaderboardEntry[]>
  fetchDailyLeaderboard: (boardSize: number, date: string) => Promise<LeaderboardEntry[]>
  fetchStreakLeaderboard: (today: string) => Promise<StreakEntry[]>
  dailyBoardSize: number
  dailyDate: string
  // Today's daily rolls are the same for everyone, so a board that hasn't
  // been played yet is a spoiler — only reveal daily boards to someone who
  // has already finished today's attempt themselves.
  dailyCompleted: boolean
  onClose: () => void
  backLabel?: string
}

export function LeaderboardScreen({
  rememberedName,
  fetchLeaderboard,
  fetchDailyLeaderboard,
  fetchStreakLeaderboard,
  dailyBoardSize,
  dailyDate,
  dailyCompleted,
  onClose,
  backLabel = 'Back to game',
}: LeaderboardScreenProps) {
  const [mode, setMode] = useState<Mode>('freeplay')
  const [window, setWindow] = useState<LeaderboardWindow>('day')
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [streakEntries, setStreakEntries] = useState<StreakEntry[] | null>(null)
  const [selected, setSelected] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null)
  const boardSize = mode === 'daily' ? dailyBoardSize : BOARD_SIZE

  useEffect(() => {
    if (mode === 'streaks') return
    let cancelled = false
    setEntries(null)
    const request = mode === 'daily' ? fetchDailyLeaderboard(dailyBoardSize, dailyDate) : fetchLeaderboard(BOARD_SIZE, window)
    request.then(result => {
      if (!cancelled) setEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [mode, window, fetchLeaderboard, fetchDailyLeaderboard, dailyBoardSize, dailyDate])

  useEffect(() => {
    if (mode !== 'streaks') return
    let cancelled = false
    setStreakEntries(null)
    fetchStreakLeaderboard(dailyDate).then(result => {
      if (!cancelled) setStreakEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [mode, fetchStreakLeaderboard, dailyDate])

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label={backLabel}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">Leaderboard</span>
      </div>

      <div className="heatmap-toggle leaderboard-toggle" role="group" aria-label="Leaderboard mode">
        <button
          type="button"
          className={`heatmap-toggle__option${mode === 'freeplay' ? ' heatmap-toggle__option--active' : ''}`}
          aria-pressed={mode === 'freeplay'}
          onClick={() => setMode('freeplay')}
        >
          Free play
        </button>
        <button
          type="button"
          className={`heatmap-toggle__option${mode === 'daily' ? ' heatmap-toggle__option--active' : ''}`}
          aria-pressed={mode === 'daily'}
          onClick={() => setMode('daily')}
        >
          Daily
        </button>
        <button
          type="button"
          className={`heatmap-toggle__option${mode === 'streaks' ? ' heatmap-toggle__option--active' : ''}`}
          aria-pressed={mode === 'streaks'}
          onClick={() => setMode('streaks')}
        >
          Streaks
        </button>
      </div>

      {mode === 'freeplay' && (
        <div className="heatmap-toggle leaderboard-toggle" role="group" aria-label="Leaderboard time range">
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
      )}

      <div className="stats-screen__body">
        {mode === 'streaks' ? (
          <>
            {streakEntries === null ? (
              <p className="stats-screen__empty">Loading leaderboard.</p>
            ) : streakEntries.length === 0 ? (
              <p className="stats-screen__empty">No active streaks yet. Be the first.</p>
            ) : (
              <ol className="daily-history__list leaderboard-list">
                {streakEntries.map((entry, index) => {
                  const isYou = entry.name === rememberedName
                  const rowClassName = isYou ? 'daily-history__row leaderboard-row leaderboard-row--you' : 'daily-history__row leaderboard-row'
                  return (
                    <li key={`${entry.name}-${index}`}>
                      <div className={rowClassName}>
                        <span className="leaderboard-row__rank">{index + 1}</span>
                        <span className="leaderboard-row__name">
                          {entry.name}
                          {isYou ? ' · you' : ''}
                        </span>
                        <span className="leaderboard-row__score">
                          {entry.streakCount} day{entry.streakCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            <p className="stats-screen__caption" style={{ textAlign: 'center' }}>
              Currently active · top {streakEntries?.length ?? 10}
            </p>
          </>
        ) : entries === null ? (
          <p className="stats-screen__empty">Loading leaderboard.</p>
        ) : entries.length === 0 ? (
          <p className="stats-screen__empty">No scores yet. Be the first.</p>
        ) : (
          <ol className="daily-history__list leaderboard-list">
            {entries.map((entry, index) => {
              const isYou = entry.name === rememberedName
              const rowClassName = isYou ? 'daily-history__row leaderboard-row leaderboard-row--you' : 'daily-history__row leaderboard-row'
              const rowContent = (
                <>
                  <span className="leaderboard-row__rank">{index + 1}</span>
                  <span className="leaderboard-row__name">
                    {entry.name}
                    {isYou ? ' · you' : ''}
                  </span>
                  <span className="leaderboard-row__score">
                    {entry.score}/{boardSize}
                  </span>
                </>
              )
              const canReveal = mode === 'freeplay' || dailyCompleted

              return (
                <li key={entry.id}>
                  {canReveal ? (
                    <button type="button" className={rowClassName} onClick={() => setSelected({ entry, rank: index + 1 })}>
                      {rowContent}
                    </button>
                  ) : (
                    <div className={rowClassName}>{rowContent}</div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        {mode !== 'streaks' && (
          <p className="stats-screen__caption" style={{ textAlign: 'center' }}>
            {mode === 'daily' ? "Today's challenge" : WINDOW_CAPTION[window]} · top {entries?.length ?? 10}
          </p>
        )}
        {mode === 'daily' && !dailyCompleted && entries !== null && entries.length > 0 && (
          <p className="stats-screen__caption" style={{ textAlign: 'center' }}>
            Finish today's challenge to see how each board played out.
          </p>
        )}
      </div>

      {selected && <LeaderboardEntryScreen entry={selected.entry} rank={selected.rank} onClose={() => setSelected(null)} />}
    </div>
  )
}
