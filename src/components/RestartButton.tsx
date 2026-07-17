import { useEffect, useRef, useState } from 'react'

const CONFIRM_WINDOW_MS = 2500

interface RestartButtonProps {
  onRestart: () => void
}

export function RestartButton({ onRestart }: RestartButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const handleClick = () => {
    if (isConfirming) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setIsConfirming(false)
      onRestart()
      return
    }

    setIsConfirming(true)
    timeoutRef.current = setTimeout(() => setIsConfirming(false), CONFIRM_WINDOW_MS)
  }

  return (
    <button
      type="button"
      className={`icon-btn${isConfirming ? ' icon-btn--confirm' : ''}`}
      onClick={handleClick}
      aria-label={isConfirming ? 'Tap again to confirm restart' : 'Restart game'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
    </button>
  )
}
