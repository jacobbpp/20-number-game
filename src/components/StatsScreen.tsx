import { Fragment } from 'react'
import { BUCKET_SIZE, VALUE_BUCKETS, bucketForValue, computeInsight, describeInsight, maxCount, type StatsData } from '../game/stats'

interface StatsScreenProps {
  stats: StatsData
  onClose: () => void
}

const PANEL_RGB: [number, number, number] = [42, 33, 81] // #2A2151
const AMBER_RGB: [number, number, number] = [239, 159, 39] // #EF9F27

function cellColor(count: number, peak: number): string {
  if (count === 0 || peak === 0) return 'rgb(42 33 81)'
  const t = count / peak
  const r = Math.round(PANEL_RGB[0] + (AMBER_RGB[0] - PANEL_RGB[0]) * t)
  const g = Math.round(PANEL_RGB[1] + (AMBER_RGB[1] - PANEL_RGB[1]) * t)
  const b = Math.round(PANEL_RGB[2] + (AMBER_RGB[2] - PANEL_RGB[2]) * t)
  return `rgb(${r} ${g} ${b})`
}

export function StatsScreen({ stats, onClose }: StatsScreenProps) {
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
        <span className="pill header__best">
          {totalGames} game{totalGames === 1 ? '' : 's'}
        </span>
      </div>

      {totalGames === 0 ? (
        <p className="stats-screen__empty">Play a full game to start building your stats.</p>
      ) : (
        <div className="stats-screen__body">
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
                    style={{ backgroundColor: cellColor(count, peak) }}
                  />
                ))}
              </Fragment>
            ))}
          </div>

          <div className="heatmap__legend">
            <div className="heatmap__legend-row">
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(0, peak) }} />
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(peak / 2, peak) }} />
              <span className="heatmap__legend-swatch" style={{ backgroundColor: cellColor(peak, peak) }} />
              <span>rarer → more often</span>
            </div>
            <div className="heatmap__legend-row">
              <span className="heatmap__legend-swatch heatmap__legend-swatch--last" />
              <span>outlined = last game&apos;s placement</span>
            </div>
          </div>

          {insight && <p className="stats-screen__insight">{describeInsight(insight)}</p>}
        </div>
      )}
    </div>
  )
}
