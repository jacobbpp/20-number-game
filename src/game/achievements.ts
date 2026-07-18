import type { StreakData } from './daily'
import type { StatsData } from './stats'
import { BOARD_SIZE } from './types'

export interface AchievementContext {
  stats: StatsData
  dailyStreak: StreakData
  bestScore: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  isUnlocked: (ctx: AchievementContext) => boolean
}

// Ordered as the intended "ladder" — roughly easiest to hardest — since
// that's the order they render in on the achievements screen.
export const NAMED_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-win',
    title: 'First win',
    description: 'Filled all 20 positions for the first time.',
    isUnlocked: ({ stats }) => stats.totalWins >= 1,
  },
  {
    id: 'win-streak-3',
    title: 'Win streak: 3',
    description: 'Win three games in a row.',
    isUnlocked: ({ stats }) => stats.bestWinStreak >= 3,
  },
  {
    id: 'win-streak-5',
    title: 'Win streak: 5',
    description: 'Win five games in a row.',
    isUnlocked: ({ stats }) => stats.bestWinStreak >= 5,
  },
  {
    id: 'fearless',
    title: 'Fearless',
    description: 'Win a game with hard mode on.',
    isUnlocked: ({ stats }) => stats.hardModeWins >= 1,
  },
  {
    id: 'dedicated',
    title: 'Dedicated',
    description: 'Play 25 games.',
    isUnlocked: ({ stats }) => stats.totalGames >= 25,
  },
  {
    id: 'week-streak',
    title: 'Week streak',
    description: 'Keep the daily streak alive for 7 days.',
    isUnlocked: ({ dailyStreak }) => dailyStreak.bestStreak >= 7,
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Play 100 games.',
    isUnlocked: ({ stats }) => stats.totalGames >= 100,
  },
]

// One per possible free-play score, 1 through the board size. Free play
// only — bestScore has no equivalent on the daily challenge, whose board
// size varies from day to day, so "N/20" wouldn't mean the same thing there.
export const SCORE_MILESTONES: Achievement[] = Array.from({ length: BOARD_SIZE }, (_, i) => {
  const n = i + 1
  return {
    id: `score-${n}`,
    title: `${n}/${BOARD_SIZE}`,
    description: `Place at least ${n} number${n === 1 ? '' : 's'} in a single free-play game.`,
    isUnlocked: ({ bestScore }: AchievementContext) => bestScore >= n,
  }
})

export const ACHIEVEMENTS: Achievement[] = [...NAMED_ACHIEVEMENTS, ...SCORE_MILESTONES]

export function unlockedAchievementIds(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter(achievement => achievement.isUnlocked(ctx)).map(achievement => achievement.id)
}
