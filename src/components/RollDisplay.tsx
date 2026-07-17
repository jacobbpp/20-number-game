interface RollDisplayProps {
  currentRoll: number | null
  placedCount: number
  total: number
}

export function RollDisplay({ currentRoll, placedCount, total }: RollDisplayProps) {
  return (
    <div className="roll-display">
      <span className="roll-display__label">rolled</span>
      <div
        className="roll-display__tile"
        key={currentRoll ?? 'empty'}
        aria-label={currentRoll !== null ? `Rolled ${currentRoll}` : 'No number rolled yet'}
      >
        {currentRoll ?? '—'}
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
