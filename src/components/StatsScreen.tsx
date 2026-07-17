import { Fragment, useState } from 'react'
import {
  BUCKET_SIZE,
  CLOSE_CALL_MARGIN,
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
import type { Theme } from '../hooks/useTheme'
import { lerpColor, type RGB } from '../utils/color'

type HeatmapView = 'all' | 'wins' | 'losses'

interface StatsScreenProps {
  stats: StatsData
  theme: Theme
  onClose: () => void
  onOpenHowToPlay: () => void
}

const PANEL_RGB_DARK: RGB = [42, 33, 81] // #2A2151
const PANEL_RGB_LIGHT: RGB = [236, 233, 251] // #ECE9FB
const AMBER_RGB: RGB = [239, 159, 39] // #EF9F27

function cellColor(count: number, peak: number, theme: Theme): string {
  const zeroRgb = theme === 'light' ? PANEL_RGB_LIGHT : PANEL_RGB_DARK
  return lerpColor(zeroRgb, AMBER_RGB, peak === 0 ? 0 : count / peak)
}

export function StatsScreen({ stats, theme, onClose, onOpenHowToPlay }: StatsScreenProps) {
  const { totalGames, lastGame } = stats
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('all')
  const activeMatrix = heatmapView === 'wins' ? stats.winMatrix : heatmapView === 'losses' ? stats.lossMatrix : stats.matrix
  const peak = maxCount(activeMatrix)
  const insight = computeInsight(stats)
  const rate = winRate(stats)
  const avgTurns = averageTurns(stats)
  const avgTurnsWins = averageTurnsInWins(stats)
  const lossBucket = mostCommonLossBucket(stats)
  const scoreMax = Math.max(...stats.scoreDistribution, 1)

  const lastGameBucketByPosition = new Map<number, number>()
  lastGame?.placements.forEach(p => lastGameBucketByPosition.set(p.position, bucketForValue(p.value)))

  return (
    <div className="stats-screen">
      <div className="stats-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="stats-screen__title">Stats</span>
        <button type="button" className="icon-btn icon-btn--small" onClick={onOpenHowToPlay} aria-label="How to play">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.75c0 1.5-2.15 2-2.4 3.25" />
            <path d="M12 17.5v.01" />
          </svg>
        </button>
        <span className="pill header__best">
          {totalGames} game{totalGames === 1 ? '' : 's'}
        </span>
      </div>

      {totalGames === 0 ? (
        <p className="stats-screen__empty">Play a full game to start building your stats.</p>
      ) : (
        <div className="stats-screen__body">
          <p className="stats-screen__section-label">Overview</p>
          <div className="stats-overview">
            <div className="stats-overview__card">
              <span className="stats-overview__label">Win rate</span>
              <span className="stats-overview__value">{rate}%</span>
            </div>
            <div className="stats-overview__card">
              <span className="stats-overview__label">Win streak</span>
              <span className="stats-overview__value">{stats.currentWinStreak}</span>
              {stats.bestWinStreak > 0 && <span className="stats-overview__sublabel">Best: {stats.bestWinStreak}</span>}
            </div>
            <div className="stats-overview__card">
              <span className="stats-overview__label">Avg. turns</span>
              <span className="stats-overview__value">{avgTurns?.toFixed(1)}</span>
            </div>
            <div className="stats-overview__card">
              <span className="stats-overview__label">Avg. turns (wins)</span>
              <span className="stats-overview__value">{avgTurnsWins !== null ? avgTurnsWins.toFixed(1) : '—'}</span>
            </div>
          </div>

          {stats.closeCallCount > 0 && (
            <div className="stats-overview__card stats-overview__card--wide">
              <span className="stats-overview__label">So close ({BOARD_SIZE - CLOSE_CALL_MARGIN}+ of {BOARD_SIZE})</span>
              <span className="stats-overview__value">
                {stats.closeCallCount} game{stats.closeCallCount === 1 ? '' : 's'}
              </span>
            </div>
          )}

          {(lossBucket !== null || insight) && (
            <div className="stats-screen__insight">
              {lossBucket !== null && <p>Most losses happen when rolling in the {bucketLabel(lossBucket)} range.</p>}
              {insight && <p>{describeInsight(insight)}</p>}
            </div>
          )}

          <div className="score-distribution">
            <p className="stats-screen__caption">How far your runs usually get</p>
            <div
              className="score-distribution__bars"
              role="img"
              aria-label={`How far your runs usually get: ${describeScoreDistribution(stats.scoreDistribution, BOARD_SIZE)}`}
            >
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
        </div>
      )}
    </div>
  )
}
