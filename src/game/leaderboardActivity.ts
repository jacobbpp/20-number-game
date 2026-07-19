export type LeaderboardWindow = 'day' | 'week' | 'month' | 'all'

// One entry per completed free-play game, logged the moment the qualifying
// check resolves — whether or not it actually qualified for anything, so
// "games played today" has a real denominator to sit next to the counts
// of how many of them made a board.
export interface LeaderboardActivityEntry {
  date: string
  windows: LeaderboardWindow[]
}

export interface LeaderboardActivitySummary {
  gamesToday: number
  madeToday: { day: number; week: number; month: number; all: number }
}

export function summarizeActivity(log: LeaderboardActivityEntry[], today: string): LeaderboardActivitySummary {
  const todays = log.filter(entry => entry.date === today)
  return {
    gamesToday: todays.length,
    madeToday: {
      day: todays.filter(entry => entry.windows.includes('day')).length,
      week: todays.filter(entry => entry.windows.includes('week')).length,
      month: todays.filter(entry => entry.windows.includes('month')).length,
      all: todays.filter(entry => entry.windows.includes('all')).length,
    },
  }
}

// Returns null when there's nothing to say yet — no games today, or none of
// today's games have cracked a board — so the caller can skip the card
// entirely rather than render an empty or zeroed-out sentence.
export function describeLeaderboardReach(summary: LeaderboardActivitySummary): string | null {
  const { gamesToday, madeToday } = summary
  if (gamesToday === 0) return null

  const parts: string[] = []
  if (madeToday.day > 0) parts.push(`${madeToday.day} made today's board`)
  if (madeToday.week > 0) parts.push(`${madeToday.week} made this week's`)
  if (madeToday.month > 0) parts.push(`${madeToday.month} made this month's`)
  if (madeToday.all > 0) parts.push(`${madeToday.all} made the all-time board`)
  if (parts.length === 0) return null

  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
  return `${gamesToday} game${gamesToday === 1 ? '' : 's'} played today. ${joined}.`
}
