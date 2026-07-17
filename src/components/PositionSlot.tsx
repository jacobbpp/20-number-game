interface PositionSlotProps {
  index: number
  value: number | null
  isValid: boolean
  accentColor: string
  onSelect: (index: number) => void
}

export function PositionSlot({ index, value, isValid, accentColor, onSelect }: PositionSlotProps) {
  const filled = value !== null
  const displayPosition = index + 1

  const label = filled
    ? `Position ${displayPosition}, filled with ${value}`
    : isValid
      ? `Position ${displayPosition}, empty, valid placement`
      : `Position ${displayPosition}, empty, not a valid placement`

  return (
    <button
      type="button"
      className={`slot${filled ? ' slot--filled' : ''}${isValid ? ' slot--valid' : ''}`}
      onClick={() => onSelect(index)}
      disabled={filled || !isValid}
      aria-label={label}
    >
      <span
        className="slot__index"
        aria-hidden="true"
        style={filled || isValid ? undefined : { background: accentColor }}
      >
        {displayPosition}
      </span>
      <span className="slot__value" aria-hidden="true">
        {filled ? value : isValid ? 'tap' : '—'}
      </span>
    </button>
  )
}
