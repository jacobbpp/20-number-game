import { Fragment } from 'react'
import { BUCKET_SIZE, VALUE_BUCKETS, bucketForValue, computeInsight, describeInsight, maxCount, type StatsData } from '../game/stats'
import type { Theme } from '../hooks/useTheme'
import { lerpColor, type RGB } from '../utils/color'

interface StatsScreenProps {
  stats: StatsData
  theme: Theme
  onToggleTheme: () => void
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

export function StatsScreen({ stats, theme, onToggleTheme, onClose, onOpenHowToPlay }: StatsScreenProps) {
  const { matrix, totalGames, lastGame } = stats
  const peak = maxCount(matrix)
  const insight = computeInsight(stats)

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
        <button
          type="button"
          className="icon-btn icon-btn--small"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6 19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4 19 5" />
            </svg>
          )}
        </button>
        <span className="pill header__best">
          {totalGames} game{totalGames === 1 ? '' : 's'}
        </span>
      </div>

      {totalGames === 0 ? (
        <p className="stats-screen__empty">Play a full game to start building your stats.</p>
      ) : (
        <div className="stats-screen__body">
          {insight && <p className="stats-screen__insight">{describeInsight(insight)}</p>}

          <p className="stats-screen__caption">Where each value range has landed, by position</p>

          <div className="heatmap" role="img" aria-label="Heatmap of how often each value range has been placed at each position, with last game's placements outlined">
            <span aria-hidden="true" />
            {Array.from({ length: VALUE_BUCKETS }, (_, bucket) => (
              <span key={bucket} className="heatmap__col-label" aria-hidden="true">
                {bucket * BUCKET_SIZE + 1}
              </span>
            ))}

            {matrix.map((row, position) => (
              <Fragment key={position}>
                <span className="heatmap__row-label" aria-hidden="true">
                  {position + 1}
                </span>
                {row.map((count, bucket) => (
                  <span
                    key={bucket}
                    className={`heatmap__cell${lastGameBucketByPosition.get(position) === bucket ? ' heatmap__cell--last' : ''}`}
                    style={{ backgroundColor: cellColor(count, peak, theme) }}
                  />
                ))}
              </Fragment>
            ))}
          </div>

          <div className="heatmap__legend">
            <div className="heatmap__legend-row">
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(0, peak, theme) }} />
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(peak / 2, peak, theme) }} />
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(peak, peak, theme) }} />
              <span>rarer → more often</span>
            </div>
            <div className="heatmap__legend-row">
              <span className="heatmap__legend-swatch heatmap__legend-swatch--last" />
              <span>outlined = last game&apos;s placement</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
