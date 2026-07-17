interface PositionSlotProps {
  index: number
  value: number | null
  isValid: boolean
  hardMode: boolean
  accentColor: string
  onSelect: (index: number) => void
}

export function PositionSlot({ index, value, isValid, hardMode, accentColor, onSelect }: PositionSlotProps) {
  const filled = value !== null
  const displayPosition = index + 1
  // Hard mode hides which empty slots are legal — visually and in the
  // accessible name alike, so screen-reader users don't get an advantage
  // sighted players don't have. Every empty slot reads and behaves the
  // same; a wrong tap is a silent no-op (place() already rejects it).
  const revealValid = isValid && !hardMode
  const canTap = !filled && (hardMode || isValid)

  const label = filled
    ? `Position ${displayPosition}, filled with ${value}`
    : hardMode
      ? `Position ${displayPosition}, empty`
      : isValid
        ? `Position ${displayPosition}, empty, valid placement`
        : `Position ${displayPosition}, empty, not a valid placement`

  return (
    <button
      type="button"
      className={`slot${filled ? ' slot--filled' : ''}${revealValid ? ' slot--valid' : ''}`}
      onClick={() => onSelect(index)}
      disabled={filled || !canTap}
      aria-label={label}
    >
      <span
        className="slot__index"
        aria-hidden="true"
        style={filled || revealValid ? undefined : { background: accentColor }}
      >
        {displayPosition}
      </span>
      <span className="slot__value" aria-hidden="true">
        {filled ? value : canTap ? 'tap' : '—'}
      </span>
    </button>
  )
}
