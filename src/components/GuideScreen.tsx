import { useState } from 'react'

interface GuideScreenProps {
  onClose: () => void
}

interface Entry {
  term: string
  desc: string
}

const STATS_ENTRIES: Entry[] = [
  {
    term: 'Heatmap',
    desc: "Where each value range has landed, by position, across every completed game. Darker cells mean it's landed there more often. Filter to wins only, losses only, or both; the outline marks where your last game's numbers went.",
  },
  {
    term: 'Win rate and streak',
    desc: "Percent of games won overall, your current win streak, and your best-ever streak once you've broken one.",
  },
  {
    term: 'Daily streak',
    desc: "The same idea for the daily challenge: how many days in a row you've played, current and best.",
  },
  {
    term: 'Average score',
    desc: 'Average number of positions filled per game, overall and in wins only, plus a chart of how far your runs usually get.',
  },
  {
    term: 'Leaderboard',
    desc: "Top 10 free-play games by day, week, month, and all time — the ten best games, so one player can hold more than one spot. A Daily mode covers today's specific challenge only, since the board size changes every day. Tap an entry to see the board it was set on, including which number ended the run — for Daily entries, that's only revealed once you've finished today's own attempt, since everyone gets the same rolls. A Streaks mode ranks the longest currently active daily streaks — a single list, since a streak doesn't reset by time window the way a score does.",
  },
  {
    term: 'Best run',
    desc: "Tap \"Best\" in the header to see the actual board from your highest-scoring free-play game, not just the number.",
  },
]

const DAILY_ENTRIES: Entry[] = [
  {
    term: "Today's challenge",
    desc: 'One shared puzzle a day: the exact same rolls, in the same order, for everyone who plays. Board size changes daily (10, 15, 25, or 30 — never 20, so it\'s never mistaken for free play).',
  },
  {
    term: 'Streak',
    desc: 'Counts consecutive days played, whether you win or lose — only missing a full day breaks it. Playing today, or having played yesterday, keeps it alive.',
  },
  {
    term: 'History',
    desc: "The last 30 days of attempts, with the date, board size, and score for each. Open it from \"View history\" on the recap screen.",
  },
  {
    term: 'What came next',
    desc: "After a loss, shows the next few rolls in that day's sequence and where (if anywhere) they'd have fit. Since the rolls are the same for everyone, it's a real answer, not a guess — but it's shown for curiosity only and doesn't change your score.",
  },
]

const INSIGHT_ENTRIES: Entry[] = [
  { term: 'Best, average, and games today', desc: 'Your best-ever score, average score with a trend arrow against last week, and games played today with a 7-day sparkline.' },
  { term: 'Last 30 days', desc: 'A calendar of games played each day, with your busiest day ever highlighted.' },
  {
    term: 'Performance by range',
    desc: 'A bar for every value range, showing which you handle best and which trips you up most. Once there\'s a clear toughest range, a "Practice" button starts a free-play game weighted toward it — still a real game, and it counts toward your stats like any other. A "Practicing X–Y" banner shows during that game, with a Stop link to end it early and go back to a normal roll without losing your board progress.',
  },
  { term: 'Leaderboard reach', desc: "How many of today's games made the day, week, month, and all-time leaderboards." },
  { term: 'Best score over time', desc: 'A line chart of your personal best climbing as you set new records.' },
  { term: 'Closest calls', desc: 'How many games have ended exactly one placement short of your best.' },
  { term: 'Signature position', desc: 'Your single most-used board position, across every game.' },
  { term: 'Last game', desc: 'Whether your last game matched or broke your usual placement pattern.' },
  { term: 'Best position', desc: 'The board position with your best record behind it.' },
  { term: 'Board half', desc: 'Whether the top or bottom half of the board treats you better.' },
  { term: 'Hard mode', desc: 'Whether hard mode has slowed your results down or not.' },
  { term: 'Streak momentum', desc: 'How close an active win streak is to your all-time best.' },
]

const ACHIEVEMENTS_ENTRY: Entry = {
  term: 'Trophy pill',
  desc: 'Opens your achievements: a milestone badge for every free-play score from 1 to 20, plus named achievements for your first win, win streaks, games played, daily streaks, and winning with hard mode on.',
}

const SETTINGS_ENTRIES: Entry[] = [
  { term: 'Sound', desc: 'Mutes or unmutes the placement, win, loss, and share sound effects.' },
  { term: 'Theme', desc: "Switches between dark and light. Defaults to your device's own setting until you change it here." },
  {
    term: 'Hard mode',
    desc: "Turns off the valid-position highlight everywhere. Nothing tells you where a number legally goes; a wrong tap just does nothing.",
  },
  {
    term: 'Home screen',
    desc: 'Turns the "Ready to play?" landing screen on or off. Off skips straight to the board on every load.',
  },
  { term: 'Version', desc: "Shows the version you're on. Tap it to browse the full release history." },
  {
    term: 'Reset all data',
    desc: "Clears every saved score, stat, streak, and preference on this device. Requires a second tap to confirm, and can't be undone.",
  },
]

function GuideEntry({ term, desc }: Entry) {
  return (
    <div className="guide-entry">
      <p className="guide-entry__term">{term}</p>
      <p className="guide-entry__desc">{desc}</p>
    </div>
  )
}

export function GuideScreen({ onClose }: GuideScreenProps) {
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">Guide</span>
      </div>

      <div className="stats-screen__body">
        <p className="guide-section__label">Stats</p>
        <div className="guide-list">
          {STATS_ENTRIES.map(entry => (
            <GuideEntry key={entry.term} {...entry} />
          ))}

          <div className="guide-entry">
            <p className="guide-entry__term">Insights</p>
            <p className="guide-entry__desc">
              A best score, average score, and games-today strip, followed by pattern cards that appear once
              there's enough data behind them.
            </p>
            <button
              type="button"
              className="daily-history__toggle guide-entry__toggle"
              aria-expanded={isInsightsOpen}
              onClick={() => setIsInsightsOpen(open => !open)}
            >
              {isInsightsOpen ? 'Hide each pattern' : 'See each pattern'}
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
                className={isInsightsOpen ? 'daily-history__chevron daily-history__chevron--open' : 'daily-history__chevron'}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {isInsightsOpen && (
              <div className="guide-list guide-list--nested">
                {INSIGHT_ENTRIES.map(entry => (
                  <GuideEntry key={entry.term} {...entry} />
                ))}
              </div>
            )}
          </div>

          <GuideEntry {...ACHIEVEMENTS_ENTRY} />
        </div>

        <p className="guide-section__label">Daily Challenge</p>
        <div className="guide-list">
          {DAILY_ENTRIES.map(entry => (
            <GuideEntry key={entry.term} {...entry} />
          ))}
        </div>

        <p className="guide-section__label">Settings</p>
        <div className="guide-list">
          {SETTINGS_ENTRIES.map(entry => (
            <GuideEntry key={entry.term} {...entry} />
          ))}
        </div>
      </div>
    </div>
  )
}
