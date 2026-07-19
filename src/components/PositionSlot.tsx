interface PositionSlotProps {
  index: number
  value: number | null
  isValid: boolean
  hardMode: boolean
  isSuggested: boolean
  accentColor: string
  onSelect: (index: number) => void
}

export function PositionSlot({ index, value, isValid, hardMode, isSuggested, accentColor, onSelect }: PositionSlotProps) {
  const filled = value !== null
  const displayPosition = index + 1
  // Hard mode hides which empty slots are legal — visually and in the
  // accessible name alike, so screen-reader users don't get an advantage
  // sighted players don't have. Every empty slot reads and behaves the
  // same; a wrong tap is a silent no-op (place() already rejects it).
  const revealValid = isValid && !hardMode
  const canTap = !filled && (hardMode || isValid)
  // The "usual spot" marker is a nudge among already-legal choices, not a
  // new source of legality information — so it only ever shows alongside
  // the existing valid-position highlight, never in hard mode.
  const showSuggestion = revealValid && isSuggested

  const label = filled
    ? `Position ${displayPosition}, filled with ${value}`
    : hardMode
      ? `Position ${displayPosition}, empty`
      : revealValid
        ? `Position ${displayPosition}, empty, valid placement${showSuggestion ? ', where players usually place this range' : ''}`
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
      {showSuggestion && <span className="slot__suggested" aria-hidden="true" />}
    </button>
  )
}
