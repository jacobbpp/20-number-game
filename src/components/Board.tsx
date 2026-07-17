import { PositionSlot } from './PositionSlot'
import { lerpColor, type RGB } from '../utils/color'

interface BoardProps {
  positions: (number | null)[]
  validPositions: number[]
  onSelect: (index: number) => void
}

const CORAL_RGB: RGB = [240, 153, 123] // #F0997B
const PURPLE_RGB: RGB = [107, 90, 158] // #6B5A9E
const AMBER_RGB: RGB = [239, 159, 39] // #EF9F27

function railColorAt(t: number): string {
  return t <= 0.5 ? lerpColor(CORAL_RGB, PURPLE_RGB, t / 0.5) : lerpColor(PURPLE_RGB, AMBER_RGB, (t - 0.5) / 0.5)
}

export function Board({ positions, validPositions, onSelect }: BoardProps) {
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
      {Array.from({ length: columns }, (_, i) => (
        <span
          key={i}
          className="board__rail"
          aria-hidden="true"
          style={{
            left: `calc((100% - 16px) * ${i / columns} + 8px)`,
            background: `linear-gradient(180deg, ${railColorAt(i / columns)} 0%, ${railColorAt((i + 1) / columns)} 100%)`,
          }}
        />
      ))}
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
