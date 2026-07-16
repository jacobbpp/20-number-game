interface HeaderProps {
  bestScore: number
}

export function Header({ bestScore }: HeaderProps) {
  return (
    <header className="header">
      <span className="header__title">Order 20</span>
      <span className="header__best">Best {bestScore}</span>
    </header>
  )
}
