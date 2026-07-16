interface RollDisplayProps {
  currentRoll: number | null
  placedCount: number
  total: number
}

export function RollDisplay({ currentRoll, placedCount, total }: RollDisplayProps) {
  return (
    <div className="roll-display">
      <span className="roll-display__label">rolled</span>
      <div className="roll-display__tile" key={currentRoll ?? 'empty'}>
        {currentRoll ?? '—'}
      </div>
      <p className="roll-display__status">
        {placedCount} of {total} placed
        {currentRoll !== null && ' · tap a lit position'}
      </p>
    </div>
  )
}
