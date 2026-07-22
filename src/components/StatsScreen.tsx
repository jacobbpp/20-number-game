import { Fragment, useState } from 'react'
import {
  BUCKET_SIZE,
  VALUE_BUCKETS,
  allValueRangeStats,
  averageTurns,
  averageTurnsInWins,
  bestPositionInsight,
  boardHalfComparison,
  bucketForValue,
  bucketLabel,
  computeInsight,
  describeInsight,
  describeScoreDistribution,
  hardModeWinRate,
  maxCount,
  scoreBucketLabel,
  signaturePosition,
  streakMomentum,
  winRate,
  type StatsData,
} from '../game/stats'
import { BOARD_SIZE } from '../game/types'
import { isStreakActive, type StreakData } from '../game/daily'
import {
  activityWindow,
  bestScoreTrend,
  busiestDay,
  closestCalls,
  shortGamesCount,
  todayReach,
  weeklyAverageDelta,
  type DailyActivityLog,
} from '../game/dailyActivity'
import { formatDailyDateLabel } from '../game/share'
import type { Theme } from '../hooks/useTheme'
import { lerpColor, type RGB } from '../utils/color'

type HeatmapView = 'all' | 'wins' | 'losses'
type StatsSection = 'menu' | 'heatmap' | 'wins' | 'daily' | 'average' | 'insights'
type InsightsTab = 'dashboard' | 'patterns'

const SHORT_GAME_THRESHOLD = 10

interface StatsScreenProps {
  stats: StatsData
  streak: StreakData
  today: string
  theme: Theme
  bestScore: number
  unlockedAchievementCount: number
  totalAchievementCount: number
  dailyActivity: DailyActivityLog
  onClose: () => void
  onOpenHowToPlay: () => void
  onOpenAchievements: () => void
  onOpenLeaderboard: () => void
  onPracticeRange: (bucket: number) => void
}

// Shorter than the menu row titles on purpose — the header has less room
// to work with, and the section's own content spells things out again
// right underneath (e.g. "win rate" / "average turns per game").
const SECTION_TITLES: Record<Exclude<StatsSection, 'menu'>, string> = {
  heatmap: 'Heatmap',
  wins: 'Wins',
  daily: 'Daily',
  average: 'Average',
  insights: 'Insights',
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
  onClose,
  onOpenHowToPlay,
  onOpenAchievements,
  onOpenLeaderboard,
  onPracticeRange,
}: StatsScreenProps) {
  const { totalGames, lastGame } = stats
  const [section, setSection] = useState<StatsSection>('menu')
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('all')
  const [insightsTab, setInsightsTab] = useState<InsightsTab>('dashboard')
  const activeMatrix = heatmapView === 'wins' ? stats.winMatrix : heatmapView === 'losses' ? stats.lossMatrix : stats.matrix
  const peak = maxCount(activeMatrix)
  const insight = computeInsight(stats)
  const rate = winRate(stats)
  const avgTurns = averageTurns(stats)
  const avgTurnsWins = averageTurnsInWins(stats)
  const bestPosition = bestPositionInsight(stats)
  const boardHalf = boardHalfComparison(stats)
  const momentum = streakMomentum(stats)
  const signature = signaturePosition(stats)
  const hardRate = hardModeWinRate(stats)
  const scoreMax = Math.max(...stats.scoreDistribution, 1)
  const currentDailyStreak = isStreakActive(streak, today) ? streak.count : 0

  const rangeStats = allValueRangeStats(stats)
  const todayEntry = dailyActivity[today]
  const reach = todayReach(dailyActivity, today)
  const busiest = busiestDay(dailyActivity)
  const calendarDays = activityWindow(dailyActivity, today, 30)
  const calendarMax = Math.max(...calendarDays.map(day => day.games), 1)
  const last7Days = activityWindow(dailyActivity, today, 7)
  const last7DaysMax = Math.max(...last7Days.map(day => day.games), 1)
  const trend = bestScoreTrend(dailyActivity)
  const closeCalls = closestCalls(dailyActivity, bestScore)
  const weeklyDelta = weeklyAverageDelta(dailyActivity, today)
  const shortToday = shortGamesCount(todayEntry, SHORT_GAME_THRESHOLD)

  const signalRanges = rangeStats.filter(stat => stat.hasSignal)
  const bestRangeStat = signalRanges.length > 0 ? signalRanges.reduce((a, b) => (b.winRate > a.winRate ? b : a)) : null
  const worstRangeStat = signalRanges.length > 0 ? signalRanges.reduce((a, b) => (b.winRate < a.winRate ? b : a)) : null
  const rangeChartLabel =
    bestRangeStat === null || worstRangeStat === null
      ? 'Not enough games yet to compare ranges.'
      : `Performance by value range. Best: ${bucketLabel(bestRangeStat.bucket)}. Toughest: ${bucketLabel(worstRangeStat.bucket)}.`

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
  const insightCount = patternCount + (reach.gamesToday > 0 ? 1 : 0) + (trend.length >= 2 ? 1 : 0) + (closeCalls > 0 ? 1 : 0)

  const lastGameBucketByPosition = new Map<number, number>()
  lastGame?.placements.forEach(p => lastGameBucketByPosition.set(p.position, bucketForValue(p.value)))

  const winsPreview = `${rate}% win rate · streak ${stats.currentWinStreak}`
  const dailyPreview =
    currentDailyStreak > 0
      ? `${currentDailyStreak} day streak`
      : streak.bestStreak > 0
        ? `Best: ${streak.bestStreak} days`
        : 'No streak yet'
  const averagePreview = `${avgTurns?.toFixed(1)} avg. turns`
  const insightsPreview = insightCount > 0 ? `${insightCount} pattern${insightCount === 1 ? '' : 's'} found` : 'Not enough data yet'

  const menuItems: { key: Exclude<StatsSection, 'menu'>; title: string; preview: string }[] = [
    { key: 'heatmap', title: 'Heatmap', preview: 'Where each value range lands' },
    { key: 'wins', title: 'Win rate & streak', preview: winsPreview },
    { key: 'daily', title: 'Daily streak', preview: dailyPreview },
    { key: 'average', title: 'Average score', preview: averagePreview },
    { key: 'insights', title: 'Insights', preview: insightsPreview },
  ]

  const handleBack = () => {
    if (section === 'menu') onClose()
    else setSection('menu')
  }

  const scoreChartLabel = `Average ${avgTurns?.toFixed(1)} turns per game${avgTurnsWins !== null ? `, ${avgTurnsWins.toFixed(1)} in wins` : ''}: ${describeScoreDistribution(stats.scoreDistribution, BOARD_SIZE)}`

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label={section === 'menu' ? 'Back to game' : 'Back to stats menu'}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">{section === 'menu' ? 'Stats' : SECTION_TITLES[section]}</span>
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
      ) : section === 'menu' ? (
        <div className="stats-screen__body stats-menu">
          {menuItems.map(item => (
            <button key={item.key} type="button" className="stats-menu__row" onClick={() => setSection(item.key)}>
              <span className="stats-menu__row-text">
                <span className="stats-menu__row-title">{item.title}</span>
                <span className="stats-menu__row-preview">{item.preview}</span>
              </span>
              <ChevronRightIcon />
            </button>
          ))}
          <button type="button" className="stats-menu__row" onClick={onOpenLeaderboard}>
            <span className="stats-menu__row-text">
              <span className="stats-menu__row-title">Leaderboard</span>
              <span className="stats-menu__row-preview">Top scores, day/week/month/all-time</span>
            </span>
            <ChevronRightIcon />
          </button>
        </div>
      ) : (
        <div className="stats-screen__body">
          {section === 'wins' && (
            <div className="stats-hero-row">
              <div className="stats-hero">
                <span className="stats-hero__value">{rate}%</span>
                <span className="stats-hero__label">win rate</span>
              </div>
              <div className="stats-hero">
                <span className="stats-hero__value">{stats.currentWinStreak}</span>
                <span className="stats-hero__label">win streak</span>
                {stats.bestWinStreak > 0 && <span className="stats-hero__sublabel">Best: {stats.bestWinStreak}</span>}
              </div>
            </div>
          )}

          {section === 'daily' && (
            <div className="stats-hero">
              <span className="stats-hero__value">{currentDailyStreak}</span>
              <span className="stats-hero__label">day streak</span>
              {streak.bestStreak > 0 && <span className="stats-hero__sublabel">Best: {streak.bestStreak}</span>}
            </div>
          )}

          {section === 'average' && (
            <div className="score-distribution">
              <div className="stats-hero">
                <span className="stats-hero__value">{avgTurns?.toFixed(1)}</span>
                <span className="stats-hero__label">average turns per game</span>
                {avgTurnsWins !== null && <span className="stats-hero__sublabel">{avgTurnsWins.toFixed(1)} in wins</span>}
              </div>
              <div className="score-distribution__bars" role="img" aria-label={scoreChartLabel}>
                {stats.scoreDistribution.map((count, bucket) => (
                  <div key={bucket} className="score-distribution__col" aria-hidden="true">
                    <div
                      className="score-distribution__bar"
                      style={{ height: `${(count / scoreMax) * 100}%`, backgroundColor: count === scoreMax && count > 0 ? 'var(--amber)' : 'var(--purple-pill-bg)' }}
                    />
                    <span className="score-distribution__label">{scoreBucketLabel(bucket, BOARD_SIZE)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'insights' && (
            <div className="insights-body">
              <div className="heatmap-toggle" role="group" aria-label="Insights view">
                <button
                  type="button"
                  className={`heatmap-toggle__option${insightsTab === 'dashboard' ? ' heatmap-toggle__option--active' : ''}`}
                  aria-pressed={insightsTab === 'dashboard'}
                  onClick={() => setInsightsTab('dashboard')}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  className={`heatmap-toggle__option${insightsTab === 'patterns' ? ' heatmap-toggle__option--active' : ''}`}
                  aria-pressed={insightsTab === 'patterns'}
                  onClick={() => setInsightsTab('patterns')}
                >
                  Patterns
                </button>
              </div>

              {insightsTab === 'dashboard' && (
              <>
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
              </div>

              {reach.gamesToday > 0 && shortToday > 0 && (
                <p className="stats-screen__caption" style={{ textAlign: 'center', margin: '-6px 0 0' }}>
                  {shortToday} of {reach.gamesToday} games today ended before move {SHORT_GAME_THRESHOLD}.
                </p>
              )}

              <div className="insight-panel">
                <p className="insight-panel__label">Last 30 days</p>
                <div
                  className="activity-cal"
                  role="img"
                  aria-label={`Games played each day for the last 30 days. ${
                    busiest ? `Busiest day: ${busiest.games} game${busiest.games === 1 ? '' : 's'} on ${busiest.date}.` : 'No games logged yet.'
                  }`}
                >
                  {calendarDays.map(day => {
                    const isToday = day.date === today
                    const isBusiest = busiest !== null && day.date === busiest.date && day.games > 0
                    const alpha = day.games === 0 ? 0 : 0.15 + (day.games / calendarMax) * 0.85
                    return (
                      <div
                        key={day.date}
                        className="activity-cal__cell"
                        aria-hidden="true"
                        style={{
                          background: day.games === 0 ? 'rgba(var(--surface-tint-rgb), 0.06)' : `rgba(207, 143, 95, ${alpha.toFixed(2)})`,
                          boxShadow: isToday ? '0 0 0 1.5px var(--text)' : isBusiest ? '0 0 0 1.5px #f2c869' : 'none',
                        }}
                      />
                    )
                  })}
                </div>
                <p className="stats-screen__caption" style={{ margin: '10px 0 0' }}>
                  {busiest === null
                    ? 'No games logged yet.'
                    : busiest.date === today
                      ? `Busiest day yet: ${busiest.games} game${busiest.games === 1 ? '' : 's'}, today.`
                      : `Busiest day: ${busiest.games} game${busiest.games === 1 ? '' : 's'}, on ${formatDailyDateLabel(busiest.date)}. Today: ${reach.gamesToday}.`}
                </p>
              </div>

              <div className="insight-panel">
                <p className="insight-panel__label">Performance by range</p>
                <div className="range-bars" role="img" aria-label={rangeChartLabel}>
                  {rangeStats.map(stat => {
                    const isBest = bestRangeStat !== null && stat.bucket === bestRangeStat.bucket
                    const isWorst = worstRangeStat !== null && stat.bucket === worstRangeStat.bucket && !isBest
                    const color = !stat.hasSignal ? 'var(--text-disabled)' : isBest ? 'var(--win)' : isWorst ? 'var(--danger)' : 'var(--accent)'
                    const width = stat.hasSignal ? `${Math.round(stat.winRate * 100)}%` : '8%'
                    return (
                      <div key={stat.bucket} className="range-bar-row" aria-hidden="true">
                        <span className="range-bar-row__label">{bucketLabel(stat.bucket)}</span>
                        <div className="range-bar-row__track">
                          <div className="range-bar-row__fill" style={{ width, background: color, opacity: stat.hasSignal ? 1 : 0.4 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {worstRangeStat !== null && (
                  <button type="button" className="insight-panel__action" onClick={() => onPracticeRange(worstRangeStat.bucket)}>
                    Practice {bucketLabel(worstRangeStat.bucket)}
                  </button>
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
              </>
              )}

              {insightsTab === 'patterns' && (
              <div className="insights-list">

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

              {hardRate !== null && (
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
              </div>
              )}
            </div>
          )}

          {section === 'heatmap' && (
            <>
              <div className="heatmap-section">
                <p className="stats-screen__caption">Where each value range has landed, by position</p>
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
