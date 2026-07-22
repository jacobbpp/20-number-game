import { useState } from 'react'
import type { LeaderboardWindow } from '../hooks/useLeaderboard'

// Most impressive qualifying window wins the headline — an all-time top 10
// is a bigger deal than a daily one, even though both are true at once.
const WINDOW_PRIORITY: LeaderboardWindow[] = ['all', 'month', 'week', 'day']

const WINDOW_HEADLINE: Record<LeaderboardWindow, string> = {
  all: "You're an all-time top 10!",
  month: 'Top 10 this month!',
  week: 'Top 10 this week!',
  day: 'Top 10 today!',
}

function headlineFor(windows: LeaderboardWindow[]): string {
  const best = WINDOW_PRIORITY.find(window => windows.includes(window))
  return best ? WINDOW_HEADLINE[best] : 'Top 10!'
}

interface LeaderboardPromptProps {
  windows?: LeaderboardWindow[]
  headline?: string
  rememberedName: string
  onSave: (name: string) => void
  onSkip: () => void
}

export function LeaderboardPrompt({ windows, headline, rememberedName, onSave, onSkip }: LeaderboardPromptProps) {
  const [name, setName] = useState(rememberedName)
  const trimmed = name.trim()
  const text = headline ?? (windows ? headlineFor(windows) : 'Top 10!')

  return (
    <div className="leaderboard-prompt">
      <p className="leaderboard-prompt__text">{text} Enter a name for the board.</p>
      <input
        className="leaderboard-prompt__input"
        value={name}
        onChange={event => setName(event.target.value.toUpperCase().slice(0, 8))}
        maxLength={8}
        aria-label="Name for the leaderboard"
        autoFocus
      />
      <p className="leaderboard-prompt__hint">Up to 8 characters. Remembered for next time.</p>
      <div className="overlay__actions">
        <button type="button" className="btn btn--secondary" onClick={onSkip}>
          Skip
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onSave(trimmed)} disabled={trimmed.length === 0}>
          Save score
        </button>
      </div>
    </div>
  )
}
