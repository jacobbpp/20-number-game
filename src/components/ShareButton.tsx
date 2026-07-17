import { useEffect, useRef, useState } from 'react'
import { buildDailyShareText, buildShareText } from '../game/share'
import { vibrate } from '../utils/haptics'

interface ShareButtonProps {
  positions: (number | null)[]
  placedCount: number
  won: boolean
  dailyDate?: string
}

export function ShareButton({ positions, placedCount, won, dailyDate }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = dailyDate
      ? buildDailyShareText(positions, placedCount, won, dailyDate, url)
      : buildShareText(positions, placedCount, won, url)

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }

    vibrate('copy')
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button type="button" className="btn btn--secondary" onClick={handleShare}>
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
