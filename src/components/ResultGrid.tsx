interface ResultGridProps {
  positions: (number | null)[]
}

export function ResultGrid({ positions }: ResultGridProps) {
  return (
    <div className="result-grid" aria-hidden="true">
      {positions.map((value, index) => (
        <span key={index} className={`result-grid__cell${value !== null ? ' result-grid__cell--filled' : ''}`} />
      ))}
    </div>
  )
}
