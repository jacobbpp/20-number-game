interface ResultGridProps {
  positions: (number | null)[]
}

export function ResultGrid({ positions }: ResultGridProps) {
  const size = positions.length
  const columns = Math.max(1, Math.ceil(size / 10))
  const rows = Math.ceil(size / columns)

  return (
    <div
      className="result-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {positions.map((value, index) => (
        <div key={index} className={`result-grid__cell${value !== null ? ' result-grid__cell--filled' : ''}`}>
          <span className="result-grid__index">{index + 1}</span>
          <span className="result-grid__value">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}
