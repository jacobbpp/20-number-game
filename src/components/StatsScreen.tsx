import { Fragment, useState } from 'react'
import {
  BUCKET_SIZE,
  VALUE_BUCKETS,
  averageTurns,
  averageTurnsInWins,
  bucketForValue,
  bucketLabel,
  computeInsight,
  describeInsight,
  describeScoreDistribution,
  maxCount,
  mostCommonLossBucket,
  scoreBucketLabel,
  winRate,
  type StatsData,
} from '../game/stats'
import { BOARD_SIZE } from '../game/types'
import { isStreakActive, type StreakData } from '../game/daily'
import type { Theme } from '../hooks/useTheme'
import { lerpColor, type RGB } from '../utils/color'

type HeatmapView = 'all' | 'wins' | 'losses'
type StatsSection = 'menu' | 'heatmap' | 'wins' | 'daily' | 'average' | 'insights'

interface StatsScreenProps {
  stats: StatsData
  streak: StreakData
  today: string
  theme: Theme
  unlockedAchievementCount: number
  totalAchievementCount: number
  onClose: () => void
  onOpenHowToPlay: () => void
  onOpenAchievements: () => void
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
  unlockedAchievementCount,
  totalAchievementCount,
  onClose,
  onOpenHowToPlay,
  onOpenAchievements,
}: StatsScreenProps) {
  const { totalGames, lastGame } = stats
  const [section, setSection] = useState<StatsSection>('menu')
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('all')
  const activeMatrix = heatmapView === 'wins' ? stats.winMatrix : heatmapView === 'losses' ? stats.lossMatrix : stats.matrix
  const peak = maxCount(activeMatrix)
  const insight = computeInsight(stats)
  const rate = winRate(stats)
  const avgTurns = averageTurns(stats)
  const avgTurnsWins = averageTurnsInWins(stats)
  const lossBucket = mostCommonLossBucket(stats)
  const scoreMax = Math.max(...stats.scoreDistribution, 1)
  const currentDailyStreak = isStreakActive(streak, today) ? streak.count : 0

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
  const insightsPreview =
    lossBucket !== null ? `Most losses in ${bucketLabel(lossBucket)}` : insight ? 'See how your last game compared' : 'Not enough data yet'

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
            <div className="stats-screen__insight">
              {lossBucket !== null && <p>Most losses happen when rolling in the {bucketLabel(lossBucket)} range.</p>}
              {insight && <p>{describeInsight(insight)}</p>}
              {lossBucket === null && !insight && <p className="stats-screen__caption">Not enough games yet to spot a pattern — keep playing.</p>}
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
