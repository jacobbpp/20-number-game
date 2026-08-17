import { Fragment, useState } from 'react'
import { BUCKET_SIZE, VALUE_BUCKETS, averageTurns, bucketForValue, hasWins, maxCount, type StatsData } from '../game/stats'
import { addDays, isStreakActive, type StreakData } from '../game/daily'
import {
  describeNemesis,
  describeNeverBeaten,
  pickNemesis,
  pickNeverBeaten,
  type HeadToHead,
} from '../game/nemesis'
import { SHORT_BOARD_SIZE, type ShortRecord } from '../game/shortBoard'
import {
  ACTIVITY_LEVELS,
  activityLevel,
  activityWindow,
  bestScoreTrend,
  busiestDay,
  calendarGrid,
  gamesPlayed,
  leaderboardHitsForDay,
  maxScore,
  scoresForDay,
  shortGamesCount,
  todayReach,
  weeklyAverageDelta,
  type DailyActivityLog,
} from '../game/dailyActivity'
import { describeMode, displayName, formatRelativeTime, formatShare, groupByPerson } from '../game/groupFeed'
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
  // Daily-challenge record against everyone else. Empty until a leaderboard
  // name has been saved, since the record is keyed on that name.
  headToHead: HeadToHead[]
  onOpenChallenge: (invited?: string) => void
  onClose: () => void
  onOpenHowToPlay: () => void
  onOpenAchievements: () => void
  onOpenLeaderboard: () => void
  // Order 6 is found by holding the wordmark in the game header, not here.
  // This screen only offers the way back to it once it has been found.
  shortBoardUnlocked: boolean
  shortBoardRecord: ShortRecord
  onOpenShortBoard: () => void
}

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
  headToHead,
  onOpenChallenge,
  shortBoardUnlocked,
  shortBoardRecord,
  onOpenShortBoard,
  onClose,
  onOpenHowToPlay,
  onOpenAchievements,
  onOpenLeaderboard,
}: StatsScreenProps) {
  const { totalGames, lastGame } = stats
  const [section, setSection] = useState<StatsSection>('stats')
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('all')
  // One entry per person rather than one per run: the panel is a board, and
  // three rows each turned it into a wall of the same two names.
  const people = groupByPerson(groupFeed.events)
  // Both are null until there are enough shared dailies behind them, so a
  // couple of unlucky mornings never get called a rivalry.
  const nemesis = pickNemesis(headToHead)
  const neverBeaten = pickNeverBeaten(headToHead)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // Which person's runs are open, if any. Keyed on the person rather than a
  // run, because the row is now a person.
  const [openPerson, setOpenPerson] = useState<number | null>(null)
  const activeMatrix = heatmapView === 'wins' ? stats.winMatrix : heatmapView === 'losses' ? stats.lossMatrix : stats.matrix
  const peak = maxCount(activeMatrix)
  const avgTurns = averageTurns(stats)
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
                <div className="stats-hero-strip__card">
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
                  Last 24 hours
                </p>
                {groupFeed.playing > 0 && (
                  // Deliberately "has the game open", not "is playing" — the
                  // socket counts open connections, and claiming more than
                  // that would be a small lie the panel can't back up.
                  <p className="stats-screen__caption" style={{ margin: '-4px 0 10px' }}>
                    {groupFeed.playing} other {groupFeed.playing === 1 ? 'person has' : 'people have'} the game open.
                  </p>
                )}
                {people.length === 0 ? (
                  <p className="stats-screen__caption">Nobody has finished a game today.</p>
                ) : (
                  <>
                    {/* One row per person, best first, because the panel is a
                        board rather than a log. Their other runs are a tap
                        away rather than three rows each on a phone screen. */}
                    <ul className="feed">
                      {people.map((person, index) => {
                        const open = openPerson === person.person
                        const best = person.best
                        const others = person.runs.slice(1)
                        return (
                          <li key={person.person} className={index === 0 ? 'feed__item feed__item--lead' : 'feed__item'}>
                            <button
                              type="button"
                              className={open ? 'feed__row feed__row--open' : 'feed__row'}
                              aria-expanded={open}
                              aria-label={`${person.label}, ${describeMode(best.mode)}, ${best.placedCount} of ${best.boardSize}, ${formatShare(person.share)} of the board. Show runs and react.`}
                              onClick={() => setOpenPerson(current => (current === person.person ? null : person.person))}
                            >
                              {index === 0 ? (
                                <>
                                  <span className="feed__lead-eyebrow">BEST RUN</span>
                                  <span className="feed__lead-top">
                                    <span className="feed__name">{person.label}</span>
                                    <span className={best.placedCount === best.boardSize ? 'feed__lead-score feed__lead-score--win' : 'feed__lead-score'}>
                                      {best.placedCount}/{best.boardSize}
                                    </span>
                                  </span>
                                  <span className="feed__bar" aria-hidden="true">
                                    <span className="feed__bar-fill" style={{ width: `${Math.round(person.share * 100)}%` }} />
                                  </span>
                                  <span className="feed__lead-meta">
                                    {formatShare(person.share)} of the board · {describeMode(best.mode)} · {formatRelativeTime(best.at, now)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="feed__rank">{index + 1}</span>
                                  <span className="feed__name">{person.label}</span>
                                  <span className="feed__what">{describeMode(best.mode)}</span>
                                  <span className={best.placedCount === best.boardSize ? 'feed__score feed__score--win' : 'feed__score'}>
                                    {best.placedCount}/{best.boardSize}
                                  </span>
                                  <span className="feed__share">{formatShare(person.share)}</span>
                                </>
                              )}
                            </button>

                            {open && (
                              <div className="feed__runs">
                                {person.runs.map(run => (
                                  <div key={run.id} className="feed__run">
                                    <p className="feed__run-line">
                                      <span className="feed__run-score">
                                        {run.placedCount}/{run.boardSize}
                                      </span>
                                      <span className="feed__run-meta">
                                        {describeMode(run.mode)} · {formatRelativeTime(run.at, now)}
                                      </span>
                                    </p>
                                    <div className="feed__picker">
                                      {REACTION_EMOJI.map(emoji => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          className={run.myReaction === emoji ? 'feed__pick feed__pick--on' : 'feed__pick'}
                                          aria-pressed={run.myReaction === emoji}
                                          aria-label={`${emoji === run.myReaction ? 'Remove' : 'React with'} ${emoji} on ${person.label}'s ${run.placedCount} of ${run.boardSize}`}
                                          // Tapping the one you already left
                                          // takes it back, so there's no
                                          // separate clear button.
                                          onClick={() => groupFeed.react(run.id, run.myReaction === emoji ? null : emoji)}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                {others.length === 0 && <p className="feed__only">Their only run today.</p>}
                              </div>
                            )}

                            {!open && best.reactions.length > 0 && (
                              <div className="feed__reacts">
                                {best.reactions.map(reaction => (
                                  <span
                                    key={reaction.emoji}
                                    className={best.myReaction === reaction.emoji ? 'feed__react feed__react--mine' : 'feed__react'}
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
                      Everyone's best, ranked by how much of the board they filled. Tap for their other runs.
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

              {nemesis && (
                <div className="insight-card insight-card--nemesis">
                  <span className="insight-card__icon" aria-hidden="true">
                    🗡️
                  </span>
                  <div>
                    <p className="insight-card__title">Your nemesis</p>
                    <p className="nemesis__name">{nemesis.name}</p>
                    <p className="insight-card__desc">{describeNemesis(nemesis)}</p>
                    <button
                      type="button"
                      className="btn btn--primary nemesis__challenge"
                      onClick={() => onOpenChallenge(nemesis.name)}
                    >
                      Challenge {nemesis.name}
                    </button>
                    <div className="nemesis__record">
                      <span className="nemesis__tally nemesis__tally--won">{nemesis.won} won</span>
                      <span className="nemesis__tally nemesis__tally--drew">{nemesis.drew} level</span>
                      <span className="nemesis__tally nemesis__tally--lost">{nemesis.lost} lost</span>
                    </div>
                  </div>
                </div>
              )}

              {neverBeaten && (
                <div className="insight-card insight-card--never-beaten">
                  <span className="insight-card__icon" aria-hidden="true">
                    🍀
                  </span>
                  <div>
                    <p className="insight-card__title">Never beaten you</p>
                    <p className="nemesis__name">{neverBeaten.name}</p>
                    <p className="insight-card__desc">{describeNeverBeaten(neverBeaten)}</p>
                  </div>
                </div>
              )}

              <button type="button" className="stats-menu__row" onClick={() => setSection('heatmap')}>
                <span className="stats-menu__row-text">
                  <span className="stats-menu__row-title">Heatmap</span>
                  <span className="stats-menu__row-preview">Where each value range lands</span>
                </span>
                <ChevronRightIcon />
              </button>
              <button type="button" className="stats-menu__row" onClick={() => onOpenChallenge()}>
                <span className="stats-menu__row-text">
                  <span className="stats-menu__row-title">Head to head</span>
                  <span className="stats-menu__row-preview">One board, two of you, same rolls</span>
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
