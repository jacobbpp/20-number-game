import tommyHead from '../brand/assets/tommy-head-orange.png'
import { SHORT_BOARD_SIZE, type ShortRecord } from '../game/shortBoard'
import type { DailyResult } from '../hooks/useDailyChallenge'

interface HomeScreenProps {
  bestScore: number
  // The daily streak, not a win streak. A win streak on a board nobody has
  // ever filled is a zero that can never move, which is not a statistic so
  // much as a running tally of failure. Days played is the number people
  // actually chase.
  dailyStreak: number
  todayResult: DailyResult | null
  dailyBoardSize: number
  // Absent until Order 6 has been found, and this screen is the only thing
  // that ever mentions it unprompted.
  shortBoardUnlocked: boolean
  shortBoardRecord: ShortRecord
  onPlay: () => void
  onPlayDaily: () => void
  onPlayShortBoard: () => void
  onOpenStats: () => void
  onOpenHowToPlay: () => void
  onHideHomeScreen: () => void
}

export function HomeScreen({
  bestScore,
  dailyStreak,
  todayResult,
  dailyBoardSize,
  shortBoardUnlocked,
  shortBoardRecord,
  onPlay,
  onPlayDaily,
  onPlayShortBoard,
  onOpenStats,
  onOpenHowToPlay,
  onHideHomeScreen,
}: HomeScreenProps) {
  return (
    <div className="home-screen">
      <div className="home-screen__header">
        <div className="header__brand" aria-hidden="true">
          <span className="brand-badge">
            <img src={tommyHead} alt="" className="brand-badge__img" />
          </span>
          <span className="brand-wordmark">
            <span className="brand-wordmark__symbol">~/</span>
            <span className="brand-wordmark__name">order-20</span>
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={onOpenHowToPlay} aria-label="How to play">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.5-2.15 2-2.4 3.25" />
            <path d="M12 17.5v.01" />
          </svg>
        </button>
      </div>

      <h1 className="home-screen__title">Ready to play?</h1>
      <p className="home-screen__subtitle">Roll a number. Keep it in order. Beat your best.</p>

      <button type="button" className="btn btn--accent home-screen__play" onClick={onPlay}>
        Play
      </button>

      <div className="home-daily-card">
        <div className="home-daily-card__row">
          <span className="home-daily-card__eyebrow">Daily challenge</span>
          <span className={todayResult ? 'home-daily-card__badge home-daily-card__badge--done' : 'home-daily-card__badge'}>
            {todayResult ? 'Done' : 'Not played yet'}
          </span>
        </div>
        <p className="home-daily-card__desc">
          {todayResult
            ? `You've played today's ${dailyBoardSize}-slot board.`
            : `A new ${dailyBoardSize}-slot board today, the same for everyone.`}
        </p>
        <button type="button" className="btn btn--primary home-daily-card__button" onClick={onPlayDaily}>
          {todayResult ? "View today's result" : 'Play daily board'}
        </button>
      </div>

      {shortBoardUnlocked && (
        <button type="button" className="home-short-card" onClick={onPlayShortBoard}>
          <span className="home-short-card__badge" aria-hidden="true">
            {SHORT_BOARD_SIZE}
          </span>
          <span className="home-short-card__text">
            <span className="home-short-card__title">Order {SHORT_BOARD_SIZE}</span>
            <span className="home-short-card__desc">The short board</span>
            <span className="home-short-card__record">
              {shortBoardRecord.wins > 0
                ? `Won ${shortBoardRecord.wins} ${shortBoardRecord.wins === 1 ? 'time' : 'times'}`
                : shortBoardRecord.games > 0
                  ? `${shortBoardRecord.games} ${shortBoardRecord.games === 1 ? 'try' : 'tries'}, no win yet`
                  : 'Not played yet'}
            </span>
          </span>
        </button>
      )}

      <div className="home-stats-row">
        <div className="home-stat-card">
          <p className="home-stat-card__label">Personal best</p>
          <p className="home-stat-card__value">{bestScore}</p>
        </div>
        <div className="home-stat-card">
          <p className="home-stat-card__label">Daily streak</p>
          <p className="home-stat-card__value">{dailyStreak}</p>
        </div>
      </div>

      <button type="button" className="home-screen__see-stats" onClick={onOpenStats}>
        See all stats
      </button>
      <button type="button" className="home-screen__hide" onClick={onHideHomeScreen}>
        Hide this screen
      </button>
    </div>
  )
}
