import type { StreakData } from './daily'
import type { StatsData } from './stats'

export interface AchievementContext {
  stats: StatsData
  dailyStreak: StreakData
}

export interface Achievement {
  id: string
  title: string
  description: string
  isUnlocked: (ctx: AchievementContext) => boolean
}

// Ordered as the intended "ladder" — roughly easiest to hardest — since
// that's the order they render in on the achievements screen.
export const ACHIEVEMENTS: Achievement[] = [
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

export function unlockedAchievementIds(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter(achievement => achievement.isUnlocked(ctx)).map(achievement => achievement.id)
}
