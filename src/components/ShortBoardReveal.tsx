import { SHORT_BOARD_SIZE, revealCopy, type CommunityRecord } from '../game/shortBoard'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ShortBoardRevealProps {
  // Null when the worker could not be reached. The copy changes rather than
  // waiting for it.
  community: CommunityRecord | null
  ownGames: number
  onPlay: () => void
  onClose: () => void
}

export function ShortBoardReveal({ community, ownGames, onPlay, onClose }: ShortBoardRevealProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()
  const copy = revealCopy(community, ownGames)

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="short-reveal-title" ref={containerRef}>
      <div className="overlay__card short-reveal">
        <p className="short-reveal__eyebrow">{copy.eyebrow}</p>

        <h2 id="short-reveal-title" className="short-reveal__headline">
          {copy.headline}
        </h2>

        {copy.lines.map(line => (
          <p key={line} className="short-reveal__line">
            {line}
          </p>
        ))}

        <div className="short-reveal__divider" />

        <div className="short-reveal__badge" aria-hidden="true">
          {SHORT_BOARD_SIZE}
        </div>

        <p className="short-reveal__offer-title">So here is a fair fight</p>
        <p className="short-reveal__offer">{copy.offer}</p>

        <button type="button" className="btn btn--primary" onClick={onPlay} autoFocus>
          Try it now
        </button>
        <button type="button" className="btn btn--secondary short-reveal__later" onClick={onClose}>
          Later
        </button>
      </div>
    </div>
  )
}
