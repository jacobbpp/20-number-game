import { ResultGrid } from './ResultGrid'
import { ShareButton } from './ShareButton'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { Theme } from '../hooks/useTheme'

interface WinScreenProps {
  positions: (number | null)[]
  onNewGame: () => void
  theme: Theme
}

export function WinScreen({ positions, onNewGame, theme }: WinScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="win-title" ref={containerRef}>
      <div className="overlay__card overlay__card--win">
        <h2 id="win-title" className="overlay__title">
          Perfect order!
        </h2>
        <p className="overlay__reason">All {positions.length} positions filled in ascending order.</p>
        <ResultGrid positions={positions} />
        <div className="overlay__actions">
          <button type="button" className="btn btn--primary" onClick={onNewGame} autoFocus>
            New game
          </button>
          <ShareButton positions={positions} placedCount={positions.length} won theme={theme} />
        </div>
      </div>
    </div>
  )
}
