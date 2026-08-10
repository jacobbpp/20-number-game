import { Fragment, useState } from 'react'
import {
  BUCKET_SIZE,
  VALUE_BUCKETS,
  averageTurns,
  bestPositionInsight,
  boardHalfComparison,
  bucketForValue,
  computeInsight,
  describeInsight,
  hardModeWinRate,
  hasWins,
  maxCount,
  signaturePosition,
  streakMomentum,
  winRate,
  type StatsData,
} from '../game/stats'
import { addDays, isStreakActive, type StreakData } from '../game/daily'
import { SHORT_BOARD_SIZE, type ShortRecord } from '../game/shortBoard'
import { useLongPress } from '../hooks/useLongPress'
import {
  ACTIVITY_LEVELS,
  activityLevel,
  activityWindow,
  bestScoreTrend,
  busiestDay,
  calendarGrid,
  closestCalls,
  gamesPlayed,
  leaderboardHitsForDay,
  maxScore,
  scoresForDay,
  shortGamesCount,
  todayReach,
  weeklyAverageDelta,
  type DailyActivityLog,
} from '../game/dailyActivity'
import { describeMode, displayName, formatRelativeTime } from '../game/groupFeed'
import { formatDailyDateLabel, formatFullDateLabel } from '../game/share'
import { REACTION_EMOJI, type CommunityFeed, type GroupRecap } from '../hooks/useGroupActivity'
import type { Theme } from '../hooks/useTheme'
import { lerpColor, type RGB } from '../utils/color'

type HeatmapView = 'all' | 'wins' | 'losses'
type StatsSection = 'stats' | 'heatmap'

const SHORT_GAME_THRESHOLD = 10

// Monday first, matching the grid's own padding.
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface StatsScreenProps {
  stats: StatsData
  streak: StreakData
  today: string
  theme: Theme
  bestScore: number
  unlockedAchievementCount: number
  totalAchievementCount: number
  dailyActivity: DailyActivityLog
  groupFeed: CommunityFeed
  groupRecap: GroupRecap | null
  groupRecapLoaded: boolean
  onClose: () => void
  onOpenHowToPlay: () => void
  onOpenAchievements: () => void
  onOpenLeaderboard: () => void
  // Order 6. Nothing on this screen names it: it is found by holding the one
  // number that has never moved. See game/shortBoard.ts.
  shortBoardUnlocked: boolean
  shortBoardRecord: ShortRecord
  onShortBoardPressStart: () => void
  onShortBoardFound: () => void
  onOpenShortBoard: () => void
}

// Long enough that it cannot be hit by a clumsy tap, short enough that anyone
// who holds it wondering "does this do anything" gets an answer.
const SHORT_BOARD_HOLD_MS = 3000

const SECTION_TITLES: Record<Exclude<StatsSection, 'stats'>, string> = {
  heatmap: 'Heatmap',
}

const PANEL_RGB_DARK: RGB = [42, 33, 81] // #2A2151
const PANEL_RGB_LIGHT: RGB = [236, 233, 251] // #ECE9FB
const AMBER_RGB: RGB = [239, 159, 39] // #EF9F27

function cellColor(count: number, peak: number, theme: Theme): string {
  const zeroRgb = theme === 'light' ? PANEL_RGB_LIGHT : PANEL_RGB_DARK
  return lerpColor(zeroRgb, AMBER_RGB, peak === 0 ? 0 : count / peak)
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function StatsScreen({
  stats,
  streak,
  today,
  theme,
  bestScore,
  unlockedAchievementCount,
  totalAchievementCount,
  dailyActivity,
  groupFeed,
  groupRecap,
  groupRecapLoaded,
  shortBoardUnlocked,
  shortBoardRecord,
  onShortBoardPressStart,
  onShortBoardFound,
  onOpenShortBoard,
  onClose,
  onOpenHowToPlay,
  onOpenAchievements,
  onOpenLeaderboard,
}: StatsScreenProps) {
  const { totalGames, lastGame } = stats
  const [section, setSection] = useState<StatsSection>('stats')
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('all')
  // Once it has been found there is nothing left to find, and the row below
  // is how you get back to it.
  const shortBoardPress = useLongPress({
    durationMs: SHORT_BOARD_HOLD_MS,
    onStart: onShortBoardPressStart,
    onComplete: onShortBoardFound,
  })
  const eggHandlers = shortBoardUnlocked ? {} : shortBoardPress.handlers
  const eggProgress = shortBoardUnlocked ? 0 : shortBoardPress.progress
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [openRunId, setOpenRunId] = useState<number | null>(null)
  const activeMatrix = heatmapView === 'wins' ? stats.winMatrix : heatmapView === 'losses' ? stats.lossMatrix : stats.matrix
  const peak = maxCount(activeMatrix)
  const insight = computeInsight(stats)
  const rate = winRate(stats)
  const avgTurns = averageTurns(stats)
  const bestPosition = bestPositionInsight(stats)
  const boardHalf = boardHalfComparison(stats)
  const momentum = streakMomentum(stats)
  const signature = signaturePosition(stats)
  const hardRate = hardModeWinRate(stats)
  const currentDailyStreak = isStreakActive(streak, today) ? streak.count : 0
  const dailyStreakText =
    currentDailyStreak > 0
      ? `${currentDailyStreak} day streak`
      : streak.bestStreak > 0
        ? `Best: ${streak.bestStreak} days`
        : 'No streak yet'

  // Read once per render so every row in the activity feed is measured
  // against the same instant rather than drifting apart down the list.
  const now = Date.now()
  const todayEntry = dailyActivity[today]
  const reach = todayReach(dailyActivity, today)
  const busiest = busiestDay(dailyActivity)
  const calendarDays = activityWindow(dailyActivity, today, 30)
  const calendarMax = Math.max(...calendarDays.map(day => day.games), 1)
  const calendarCells = calendarGrid(dailyActivity, today, 30)
  const selectedEntry = selectedDate === null ? undefined : dailyActivity[selectedDate]
  const selectedScores = scoresForDay(selectedEntry)
  const selectedHits = leaderboardHitsForDay(selectedEntry)
  const last7Days = activityWindow(dailyActivity, today, 7)
  const last7DaysMax = Math.max(...last7Days.map(day => day.games), 1)
  const trend = bestScoreTrend(dailyActivity)
  const closeCalls = closestCalls(dailyActivity, bestScore)
  const weeklyDelta = weeklyAverageDelta(dailyActivity, today)
  const shortToday = shortGamesCount(todayEntry, SHORT_GAME_THRESHOLD)
  const passedToday = reach.gamesToday - shortToday
  const yesterdayEntry = dailyActivity[addDays(today, -1)]
  const yesterdayGames = gamesPlayed(yesterdayEntry)
  const yesterdayPassed = yesterdayGames - shortGamesCount(yesterdayEntry, SHORT_GAME_THRESHOLD)

  const trendMin = trend.length > 0 ? trend[0].score : 0
  const trendMax = trend.length > 0 ? trend[trend.length - 1].score : 0
  const trendPoints = trend.map((point, index) => ({
    ...point,
    x: trend.length > 1 ? (index / (trend.length - 1)) * 260 : 130,
    y: trendMax === trendMin ? 24 : 6 + (1 - (point.score - trendMin) / (trendMax - trendMin)) * 36,
  }))
  const trendPolyline = trendPoints.map(point => `${point.x},${point.y}`).join(' ')

  const patternCount = [
    bestPosition !== null,
    boardHalf !== null,
    momentum !== null,
    signature !== null,
    hardRate !== null,
    insight !== null,
  ].filter(Boolean).length

  const lastGameBucketByPosition = new Map<number, number>()
  lastGame?.placements.forEach(p => lastGameBucketByPosition.set(p.position, bucketForValue(p.value)))

  const handleBack = () => {
    if (section === 'stats') onClose()
    else setSection('stats')
  }

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label={section === 'stats' ? 'Back to game' : 'Back to stats'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">{section === 'stats' ? 'Stats' : SECTION_TITLES[section]}</span>
        <button type="button" className="icon-btn icon-btn--small" onClick={onOpenHowToPlay} aria-label="How to play">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.5-2.15 2-2.4 3.25" />
            <path d="M12 17.5v.01" />
          </svg>
        </button>
        <button type="button" className="pill header__best" onClick={onOpenAchievements}>
          🏆 {unlockedAchievementCount}/{totalAchievementCount}
        </button>
        <span className="pill header__best">
          {totalGames} game{totalGames === 1 ? '' : 's'}
        </span>
      </div>

      {totalGames === 0 ? (
        <p className="stats-screen__empty">Play a full game to start building your stats.</p>
      ) : (
        <div className="stats-screen__body">
          {section === 'stats' && (
            <div className="insights-body">
              <p className="stats-screen__caption" style={{ textAlign: 'center' }}>
                Daily streak: {dailyStreakText}
              </p>

              <div className="stats-hero-strip">
                <div className="stats-hero-strip__card">
                  <p className="stats-hero-strip__value">{bestScore}</p>
                  <p className="stats-hero-strip__label">best score</p>
                </div>
                <div className="stats-hero-strip__card">
                  <p className="stats-hero-strip__value">{avgTurns?.toFixed(1) ?? '—'}</p>
                  <p className="stats-hero-strip__label">avg. score</p>
                  {weeklyDelta !== null && weeklyDelta.thisWeek !== weeklyDelta.lastWeek && (
                    <p
                      className={
                        weeklyDelta.thisWeek > weeklyDelta.lastWeek
                          ? 'stats-hero-strip__delta stats-hero-strip__delta--up'
                          : 'stats-hero-strip__delta'
                      }
                    >
                      {weeklyDelta.thisWeek > weeklyDelta.lastWeek ? '▲' : '▼'} {Math.abs(weeklyDelta.thisWeek - weeklyDelta.lastWeek).toFixed(1)}{' '}
                      vs last wk
                    </p>
                  )}
                </div>
                <div className="stats-hero-strip__card">
                  <p className="stats-hero-strip__value">{reach.gamesToday}</p>
                  <p className="stats-hero-strip__label">games today</p>
                  <div className="mini-sparkline" aria-hidden="true">
                    {last7Days.map((day, i) => (
                      <div
                        key={day.date}
                        className="mini-sparkline__bar"
                        style={{
                          height: `${Math.max(10, (day.games / last7DaysMax) * 100)}%`,
                          background: i === last7Days.length - 1 ? 'var(--cta)' : 'var(--text-disabled)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                {/* Deliberately not a button and not focusable: the way into
                    Order 6 is meant to be found, not advertised, and giving
                    this a name that hints at it would give the game away to
                    everyone at once. It still reads exactly as it did before
                    to a screen reader, which is the number and its label. */}
                <div
                  className="stats-hero-strip__card stats-hero-strip__card--egg"
                  style={eggProgress > 0 ? { ['--egg-progress' as string]: `${eggProgress * 100}%` } : undefined}
                  {...eggHandlers}
                >
                  <p className="stats-hero-strip__value">{stats.totalWins}</p>
                  <p className="stats-hero-strip__label">wins</p>
                </div>
              </div>

              {reach.gamesToday > 0 && shortToday > 0 && (
                <p className="stats-screen__caption" style={{ textAlign: 'center', margin: '-6px 0 0' }}>
                  {shortToday} of {reach.gamesToday} games today ended before move {SHORT_GAME_THRESHOLD}.
                  {yesterdayGames > 0 && (
                    <>
                      {' '}
                      {passedToday} made it further,{' '}
                      {passedToday > yesterdayPassed
                        ? `better than yesterday's ${yesterdayPassed}.`
                        : passedToday < yesterdayPassed
                          ? `yesterday had ${yesterdayPassed}.`
                          : 'same as yesterday.'}
                    </>
                  )}
                </p>
              )}

              <div className="insight-panel">
                <p className="insight-panel__label">Last 30 days</p>

                <div className="activity-cal__dows" aria-hidden="true">
                  {WEEKDAY_INITIALS.map((initial, index) => (
                    <span key={index}>{initial}</span>
                  ))}
                </div>

                <div className="activity-cal">
                  {calendarCells.map((cell, index) => {
                    // Leading blanks exist only to push the first real day into
                    // its true weekday column.
                    if (cell.date === null) {
                      return <span key={`pad-${index}`} className="activity-cal__cell activity-cal__cell--pad" aria-hidden="true" />
                    }

                    const level = activityLevel(cell.games, calendarMax)
                    const classes = ['activity-cal__cell', `activity-cal__cell--l${level}`]
                    if (cell.date === today) classes.push('activity-cal__cell--today')
                    if (cell.date === selectedDate) classes.push('activity-cal__cell--selected')

                    // A day with nothing on it has nothing to open, so it stays
                    // a plain square rather than a button that leads nowhere.
                    if (cell.games === 0) {
                      return <span key={cell.date} className={classes.join(' ')} aria-hidden="true" />
                    }

                    const dayBest = maxScore(dailyActivity[cell.date])
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        className={classes.join(' ')}
                        aria-pressed={cell.date === selectedDate}
                        aria-label={`${formatFullDateLabel(cell.date)}, ${cell.games} game${cell.games === 1 ? '' : 's'}${
                          dayBest !== null ? `, best ${dayBest}` : ''
                        }`}
                        onClick={() => setSelectedDate(current => (current === cell.date ? null : cell.date))}
                      />
                    )
                  })}
                </div>

                <div className="activity-legend" aria-hidden="true">
                  <span>Quieter</span>
                  {Array.from({ length: ACTIVITY_LEVELS + 1 }, (_, level) => (
                    <i key={level} className={`activity-cal__cell activity-cal__cell--l${level}`} />
                  ))}
                  <span>Busier</span>
                </div>

                <p className="stats-screen__caption" style={{ margin: '10px 0 0' }}>
                  {busiest === null
                    ? 'No games logged yet.'
                    : busiest.date === today
                      ? `Busiest day yet: ${busiest.games} game${busiest.games === 1 ? '' : 's'}, today.`
                      : `Busiest day: ${busiest.games} game${busiest.games === 1 ? '' : 's'}, on ${formatDailyDateLabel(busiest.date)}. Today: ${reach.gamesToday}.`}
                </p>
              </div>

              {selectedDate !== null && (
                <div className="insight-panel day-detail">
                  <div className="day-detail__top">
                    <p className="day-detail__date">{formatFullDateLabel(selectedDate)}</p>
                    <button type="button" className="day-detail__close" onClick={() => setSelectedDate(null)}>
                      Close
                    </button>
                  </div>

                  <div className="day-detail__stats">
                    <div className="day-detail__stat">
                      <p className="day-detail__stat-val">{selectedScores.length}</p>
                      <p className="day-detail__stat-lbl">game{selectedScores.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="day-detail__stat">
                      <p className="day-detail__stat-val">{selectedScores[0] ?? '—'}</p>
                      <p className="day-detail__stat-lbl">best that day</p>
                    </div>
                  </div>

                  <p className="day-detail__sub">Every score, best first</p>
                  <div className="day-detail__chips">
                    {selectedScores.map((score, index) => (
                      <span key={index} className={index === 0 ? 'day-detail__chip day-detail__chip--best' : 'day-detail__chip'}>
                        {score}
                      </span>
                    ))}
                  </div>

                  {selectedHits.length > 0 && (
                    <p className="day-detail__note">
                      {selectedHits.map(hit => `${hit.count} reached the ${hit.label} board`).join(', ')}.
                    </p>
                  )}
                </div>
              )}

              <div className="group-head">
                <span className="group-head__text">The group</span>
                <span className="group-head__rule" aria-hidden="true" />
              </div>

              <div className="insight-panel insight-panel--group">
                <p className="insight-panel__label">Yesterday in the group</p>
                {!groupRecapLoaded ? (
                  <p className="stats-screen__caption">Fetching yesterday.</p>
                ) : groupRecap === null ? (
                  <p className="stats-screen__caption">Yesterday's round-up hasn't run yet. It lands overnight.</p>
                ) : groupRecap.games === 0 ? (
                  <p className="stats-screen__caption">Nobody played yesterday.</p>
                ) : (
                  <>
                    <div className="recap-grid">
                      <div className="recap-cell">
                        <p className="recap-cell__val">{groupRecap.games}</p>
                        <p className="recap-cell__lbl">game{groupRecap.games === 1 ? '' : 's'} played</p>
                      </div>
                      <div className="recap-cell">
                        <p className="recap-cell__val">{groupRecap.players}</p>
                        <p className="recap-cell__lbl">{groupRecap.players === 1 ? 'person' : 'people'} played</p>
                      </div>
                    </div>
                    <p className="recap-line">
                      {groupRecap.busiestGames !== null && (
                        <>
                          Busiest was <b>{displayName(groupRecap.busiestName)}</b> with {groupRecap.busiestGames} game
                          {groupRecap.busiestGames === 1 ? '' : 's'}.{' '}
                        </>
                      )}
                      {groupRecap.bestScore !== null && groupRecap.bestBoardSize !== null && (
                        <>
                          Best run was <b>{displayName(groupRecap.bestName)}</b> on {groupRecap.bestScore} of {groupRecap.bestBoardSize}.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>

              <div className="insight-panel insight-panel--group">
                <p className="insight-panel__label">
                  {groupFeed.live && <span className="live-dot" aria-hidden="true" />}
                  Best runs today
                </p>
                {groupFeed.playing > 0 && (
                  // Deliberately "has the game open", not "is playing" — the
                  // socket counts open connections, and claiming more than
                  // that would be a small lie the panel can't back up.
                  <p className="stats-screen__caption" style={{ margin: '-4px 0 10px' }}>
                    {groupFeed.playing} {groupFeed.playing === 1 ? 'person has' : 'people have'} the game open.
                  </p>
                )}
                {groupFeed.events.length === 0 ? (
                  <p className="stats-screen__caption">Nobody has finished a game today.</p>
                ) : (
                  <>
                    <ul className="feed">
                      {groupFeed.events.map(event => {
                        const who = displayName(event.name)
                        const score = `${event.placedCount} of ${event.boardSize}`
                        return (
                          <li key={event.id} className="feed__item">
                            <button
                              type="button"
                              className={openRunId === event.id ? 'feed__row feed__row--open' : 'feed__row'}
                              aria-expanded={openRunId === event.id}
                              aria-label={`${who}, ${describeMode(event.mode)}, ${score}. React.`}
                              onClick={() => setOpenRunId(current => (current === event.id ? null : event.id))}
                            >
                              <span className="feed__name">{who}</span>
                              <span className="feed__what">{describeMode(event.mode)}</span>
                              <span className={event.placedCount === event.boardSize ? 'feed__score feed__score--win' : 'feed__score'}>
                                {event.placedCount}/{event.boardSize}
                              </span>
                              <span className="feed__when">{formatRelativeTime(event.at, now)}</span>
                            </button>

                            {openRunId === event.id && (
                              <div className="feed__picker">
                                {REACTION_EMOJI.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={event.myReaction === emoji ? 'feed__pick feed__pick--on' : 'feed__pick'}
                                    aria-pressed={event.myReaction === emoji}
                                    aria-label={`${emoji === event.myReaction ? 'Remove' : 'React with'} ${emoji}`}
                                    // Tapping the one you already left takes it
                                    // back, so there's no separate clear button.
                                    onClick={() => groupFeed.react(event.id, event.myReaction === emoji ? null : emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}

                            {event.reactions.length > 0 && (
                              <div className="feed__reacts">
                                {event.reactions.map(reaction => (
                                  <span
                                    key={reaction.emoji}
                                    className={event.myReaction === reaction.emoji ? 'feed__react feed__react--mine' : 'feed__react'}
                                  >
                                    {reaction.emoji} <b>{reaction.count}</b>
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    <p className="stats-screen__caption" style={{ margin: '10px 0 0' }}>
                      Everyone's three best from the last day. Tap one to react.
                    </p>
                  </>
                )}
              </div>

              {reach.gamesToday > 0 && (
                <div className="insight-panel insight-panel--leaderboard">
                  <p className="insight-panel__label insight-panel__label--leaderboard">🏆 Leaderboard reach</p>
                  <div className="reach-chips">
                    <div className="reach-chip">
                      <p className="reach-chip__val">{reach.hits.day}</p>
                      <p className="reach-chip__lbl">today</p>
                    </div>
                    <div className="reach-chip">
                      <p className="reach-chip__val">{reach.hits.week}</p>
                      <p className="reach-chip__lbl">week</p>
                    </div>
                    <div className="reach-chip">
                      <p className="reach-chip__val">{reach.hits.month}</p>
                      <p className="reach-chip__lbl">month</p>
                    </div>
                    <div className="reach-chip">
                      <p className="reach-chip__val">{reach.hits.all}</p>
                      <p className="reach-chip__lbl">all-time</p>
                    </div>
                  </div>
                </div>
              )}

              {trendPoints.length >= 2 && (
                <div className="insight-panel">
                  <p className="insight-panel__label">Best score over time</p>
                  <svg
                    viewBox="0 0 260 48"
                    width="100%"
                    height="48"
                    role="img"
                    aria-label={`Best score has climbed from ${trendMin} to ${trendMax} across ${trendPoints.length} personal bests.`}
                  >
                    <polyline points={trendPolyline} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {trendPoints.map((point, i) => (
                      <circle
                        key={point.date}
                        cx={point.x}
                        cy={point.y}
                        r={i === trendPoints.length - 1 ? 3.5 : 2}
                        fill={i === trendPoints.length - 1 ? 'var(--cta)' : 'var(--accent)'}
                      />
                    ))}
                  </svg>
                  <p className="stats-screen__caption" style={{ margin: '4px 0 0' }}>
                    From {trendMin} to {trendMax}.
                  </p>
                </div>
              )}

              {closeCalls > 0 && (
                <div className="insight-card insight-card--streak">
                  <span className="insight-card__icon" aria-hidden="true">
                    🤏
                  </span>
                  <div>
                    <p className="insight-card__title">Closest calls</p>
                    <p className="insight-card__desc">
                      {closeCalls} game{closeCalls === 1 ? '' : 's'} ended exactly one placement short of your best.
                    </p>
                  </div>
                </div>
              )}

              {signature !== null && (
                <div className="insight-card insight-card--position">
                  <span className="insight-card__icon" aria-hidden="true">
                    📍
                  </span>
                  <div>
                    <p className="insight-card__title">Signature position</p>
                    <p className="insight-card__desc">
                      Position {signature.position + 1} is your most-used slot, filled {signature.count} times.
                    </p>
                  </div>
                </div>
              )}

              {insight && (
                <div className="insight-card insight-card--neutral">
                  <span className="insight-card__icon" aria-hidden="true">
                    🔄
                  </span>
                  <div>
                    <p className="insight-card__title">Last game</p>
                    <p className="insight-card__desc">{describeInsight(insight)}</p>
                  </div>
                </div>
              )}

              {bestPosition !== null && (
                <div className="insight-card insight-card--best">
                  <span className="insight-card__icon" aria-hidden="true">
                    🧭
                  </span>
                  <div>
                    <p className="insight-card__title">Best position</p>
                    <p className="insight-card__desc">Position {bestPosition.position + 1} is where you have your best record.</p>
                  </div>
                </div>
              )}

              {boardHalf !== null && (
                <div className="insight-card insight-card--boardhalf">
                  <span className="insight-card__icon" aria-hidden="true">
                    ⚖️
                  </span>
                  <div>
                    <p className="insight-card__title">Board half</p>
                    <p className="insight-card__desc">
                      Numbers you place in the {boardHalf.strongerHalf} half of the board tend to work out better than the{' '}
                      {boardHalf.strongerHalf === 'top' ? 'bottom' : 'top'} half.
                    </p>
                  </div>
                </div>
              )}

              {/* Off until something has actually been won. With no wins at
                  all this card compares nought per cent against nought per
                  cent and concludes hard mode "hasn't slowed you down", which
                  is not encouragement, it is nonsense. */}
              {hardRate !== null && hasWins(stats) && (
                <div className="insight-card insight-card--hardmode">
                  <span className="insight-card__icon" aria-hidden="true">
                    🛡️
                  </span>
                  <div>
                    <p className="insight-card__title">Hard mode</p>
                    <p className="insight-card__desc">
                      {hardRate >= (rate ?? 0)
                        ? "Hard mode hasn't slowed you down. You do just as well without the hints."
                        : 'Hard mode is tougher for you than playing with hints on, which tracks.'}
                    </p>
                  </div>
                </div>
              )}

              {momentum !== null && (
                <div className="insight-card insight-card--streak">
                  <span className="insight-card__icon" aria-hidden="true">
                    🔥
                  </span>
                  <div>
                    <p className="insight-card__title">Streak momentum</p>
                    <p className="insight-card__desc">
                      {momentum.kind === 'record'
                        ? 'This is your best win streak yet.'
                        : `${momentum.winsToTie} more win${momentum.winsToTie === 1 ? '' : 's'} ties your best streak ever.`}
                    </p>
                  </div>
                </div>
              )}

              {patternCount === 0 && (
                <p className="stats-screen__caption">Not enough games yet to spot a pattern. Keep playing.</p>
              )}

              <button type="button" className="stats-menu__row" onClick={() => setSection('heatmap')}>
                <span className="stats-menu__row-text">
                  <span className="stats-menu__row-title">Heatmap</span>
                  <span className="stats-menu__row-preview">Where each value range lands</span>
                </span>
                <ChevronRightIcon />
              </button>
              <button type="button" className="stats-menu__row" onClick={onOpenLeaderboard}>
                <span className="stats-menu__row-text">
                  <span className="stats-menu__row-title">Leaderboard</span>
                  <span className="stats-menu__row-preview">Top scores, day/week/month/all-time</span>
                </span>
                <ChevronRightIcon />
              </button>
              {/* Only ever appears for someone who has found it, and then it
                  stays. This is also the only way back to Order 6 for anyone
                  playing with the home screen turned off. */}
              {shortBoardUnlocked && (
                <button type="button" className="stats-menu__row" onClick={onOpenShortBoard}>
                  <span className="stats-menu__row-text">
                    <span className="stats-menu__row-title">Order {SHORT_BOARD_SIZE}</span>
                    <span className="stats-menu__row-preview">
                      {shortBoardRecord.games === 0
                        ? 'The short board. Not played yet'
                        : `${shortBoardRecord.wins} ${shortBoardRecord.wins === 1 ? 'win' : 'wins'} from ${shortBoardRecord.games}`}
                    </span>
                  </span>
                  <ChevronRightIcon />
                </button>
              )}
            </div>
          )}

          {section === 'heatmap' && (
            <>
              <div className="heatmap-section">
                <p className="stats-screen__caption">Where each value range has landed, by position</p>
                {/* With nothing ever won, Wins is an empty grid and Losses is
                    identical to All, so the whole control is three buttons
                    offering one view. */}
                {hasWins(stats) && (
                <div className="heatmap-toggle" role="group" aria-label="Filter heatmap by result">
                  {(['all', 'wins', 'losses'] as const).map(view => (
                    <button
                      key={view}
                      type="button"
                      className={`heatmap-toggle__option${heatmapView === view ? ' heatmap-toggle__option--active' : ''}`}
                      aria-pressed={heatmapView === view}
                      onClick={() => setHeatmapView(view)}
                    >
                      {view === 'all' ? 'All' : view === 'wins' ? 'Wins' : 'Losses'}
                    </button>
                  ))}
                </div>
                )}
              </div>

              <div className="heatmap" role="img" aria-label={`Heatmap of how often each value range has been placed at each position${heatmapView === 'all' ? ', with last game\'s placements outlined' : ` (${heatmapView} only)`}`}>
                <span aria-hidden="true" />
                {Array.from({ length: VALUE_BUCKETS }, (_, bucket) => (
                  <span key={bucket} className="heatmap__col-label" aria-hidden="true">
                    {bucket * BUCKET_SIZE + 1}
                  </span>
                ))}

                {activeMatrix.map((row, position) => (
                  <Fragment key={position}>
                    <span className="heatmap__row-label" aria-hidden="true">
                      {position + 1}
                    </span>
                    {row.map((count, bucket) => (
                      <span
                        key={bucket}
                        className={`heatmap__cell${heatmapView === 'all' && lastGameBucketByPosition.get(position) === bucket ? ' heatmap__cell--last' : ''}`}
                        style={{ backgroundColor: cellColor(count, peak, theme) }}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              <div className="heatmap__legend">
                <div
                  className="heatmap__legend-gradient"
                  style={{ background: `linear-gradient(to right, ${cellColor(0, peak, theme)}, ${cellColor(peak, peak, theme)})` }}
                />
                <div className="heatmap__legend-row heatmap__legend-row--ends">
                  <span>Rarely lands here</span>
                  <span>Often lands here</span>
                </div>
                {heatmapView === 'all' && (
                  <div className="heatmap__legend-row">
                    <span className="heatmap__legend-swatch heatmap__legend-swatch--last" style={{ backgroundColor: cellColor(0, peak, theme) }} />
                    <span>Outlined = where you placed a number last game</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
