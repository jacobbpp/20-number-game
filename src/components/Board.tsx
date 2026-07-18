import { PositionSlot } from './PositionSlot'
import { sequenceColor } from '../utils/color'

interface BoardProps {
  positions: (number | null)[]
  validPositions: number[]
  hardMode: boolean
  suggestedPosition: number | null
  onSelect: (index: number) => void
}

export function Board({ positions, validPositions, hardMode, suggestedPosition, onSelect }: BoardProps) {
  const size = positions.length
  const columns = Math.max(1, Math.ceil(size / 10))
  const rows = Math.ceil(size / columns)

  return (
    <div
      className="board"
      role="group"
      aria-label={`${size} numbered positions, low to high`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {positions.map((value, index) => (
        <PositionSlot
          key={index}
          index={index}
          value={value}
          isValid={validPositions.includes(index)}
          hardMode={hardMode}
          isSuggested={index === suggestedPosition}
          accentColor={sequenceColor(size <= 1 ? 0 : index / (size - 1))}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
