import type { LongPress } from '../hooks/useLongPress'

interface RollDisplayProps {
  currentRoll: number | null
  placedCount: number
  total: number
  // The way into Order 6, when there is still one to find. Nothing here names
  // it: the rolled number is the thing every player looks at on every single
  // turn, which makes it the one thing everybody would eventually prod at.
  // Absent on the Order 6 board itself, which is already past that point.
  secretHold?: LongPress | null
}

export function RollDisplay({ currentRoll, placedCount, total, secretHold = null }: RollDisplayProps) {
  return (
    <div className="roll-display">
      <span className="roll-display__label">rolled</span>
      {/* The hold's state lives in the hook, not on this node, which matters
          because `key` remounts the tile on every roll for the animation. A
          press in progress is unaffected by that. */}
      <div
        className={`roll-display__tile${secretHold ? ' roll-display__tile--egg' : ''}`}
        key={currentRoll ?? 'empty'}
        aria-label={currentRoll !== null ? `Rolled ${currentRoll}` : 'No number rolled yet'}
        style={
          secretHold && secretHold.progress > 0
            ? { ['--egg-progress' as string]: `${secretHold.progress * 100}%` }
            : undefined
        }
        {...(secretHold?.handlers ?? {})}
      >
        {/* Wrapped so it can be lifted above the fill that rises behind it
            during a hold. A bare text node cannot be given a stacking order,
            and the coral would paint straight over the digits. */}
        <span className="roll-display__value">{currentRoll ?? '—'}</span>
      </div>
      {/* Separate from the animated tile above (which remounts via `key` on
          every roll) so the announcement fires reliably — a screen reader
          isn't guaranteed to announce a freshly-inserted element that
          already has aria-live set, only content changes within a node
          that was already present. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {currentRoll !== null ? `Rolled ${currentRoll}` : ''}
      </span>
      <p className="roll-display__status">
        {placedCount} of {total} placed
        {currentRoll !== null && ' · tap a lit position'}
      </p>
    </div>
  )
}
