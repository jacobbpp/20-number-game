import { useFocusTrap } from '../hooks/useFocusTrap'
import { BOARD_SIZE } from '../game/types'

interface HowToPlayScreenProps {
  onClose: () => void
}

export function HowToPlayScreen({ onClose }: HowToPlayScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="howto-title" ref={containerRef}>
      <div className="overlay__card howto">
        <h2 id="howto-title" className="overlay__title howto__title">
          How to play
        </h2>
        <p className="howto__body">
          Roll a number, then tap an empty position to place it. Every position has to stay in
          order: low at the top, high at the bottom. A number can only go somewhere with nothing
          bigger above it and nothing smaller below it.
        </p>

        <div className="howto__example">
          <div className="howto__example-row">
            <span className="howto__example-cell howto__example-cell--filled">64</span>
            <span className="howto__example-label">position 1</span>
          </div>
          <div className="howto__example-row">
            <span className="howto__example-cell howto__example-cell--filled">75</span>
            <span className="howto__example-label">position 2</span>
          </div>
          <div className="howto__example-row">
            <span className="howto__example-cell howto__example-cell--invalid">63</span>
            <span className="howto__example-label">rolled, no empty position before 64 can hold it</span>
          </div>
        </div>

        <p className="howto__body">One illegal roll ends the run. Fill all {BOARD_SIZE} to win.</p>

        <p className="howto__body">
          One tip: judge a number against the two either side of it, not against the whole board. A 515
          belongs halfway down an empty board, but if it has to fit between an existing 480 and 520 it
          belongs near the bottom of the room left between them. The dot points there.
        </p>

        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </div>
  )
}
