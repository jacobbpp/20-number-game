import { PositionSlot } from './PositionSlot'

interface BoardProps {
  positions: (number | null)[]
  validPositions: number[]
  onSelect: (index: number) => void
}

export function Board({ positions, validPositions, onSelect }: BoardProps) {
  return (
    <div className="board" role="group" aria-label="20 numbered positions, low to high">
      {positions.map((value, index) => (
        <PositionSlot
          key={index}
          index={index}
          value={value}
          isValid={validPositions.includes(index)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
