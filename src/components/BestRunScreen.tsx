import { ResultGrid } from './ResultGrid'
import type { BestRun } from '../hooks/useBestScore'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface BestRunScreenProps {
  bestScore: number
  bestRun: BestRun | null
  onClose: () => void
}

function formatAchievedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function BestRunScreen({ bestScore, bestRun, onClose }: BestRunScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="bestrun-title" ref={containerRef}>
      <div className="overlay__card">
        <h2 id="bestrun-title" className="overlay__title">
          Your best
        </h2>

        {bestRun ? (
          <>
            <p className="overlay__reason">
              {bestRun.placedCount} of {bestRun.positions.length} placed, on {formatAchievedDate(bestRun.date)}
            </p>
            <ResultGrid positions={bestRun.positions} />
          </>
        ) : bestScore > 0 ? (
          <p className="overlay__reason">
            Best score so far: {bestScore}. That run happened before this screen existed, so there's no board saved
            for it. Beat it again to see it here.
          </p>
        ) : (
          <p className="overlay__reason">Play a game to set your first best.</p>
        )}

        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  )
}
