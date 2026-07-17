interface ResultGridProps {
  positions: (number | null)[]
}

export function ResultGrid({ positions }: ResultGridProps) {
  return (
    <div className="result-grid">
      {positions.map((value, index) => (
        <div key={index} className={`result-grid__cell${value !== null ? ' result-grid__cell--filled' : ''}`}>
          <span className="result-grid__index">{index + 1}</span>
          <span className="result-grid__value">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}
