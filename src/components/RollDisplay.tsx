interface RollDisplayProps {
  currentRoll: number | null
  placedCount: number
  total: number
  awaitingPlacement: boolean
}

export function RollDisplay({ currentRoll, placedCount, total, awaitingPlacement }: RollDisplayProps) {
  return (
    <div className="roll-display">
      <span className="roll-display__label">
        {currentRoll === null ? 'press roll' : 'rolled'}
      </span>
      <div className="roll-display__tile" key={currentRoll ?? 'empty'}>
        {currentRoll ?? '—'}
      </div>
      <p className="roll-display__status">
        {placedCount} of {total} placed
        {awaitingPlacement && ' · tap a lit position'}
      </p>
    </div>
  )
}
