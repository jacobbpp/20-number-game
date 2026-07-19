import { buildDailyShareText, buildShareText } from '../game/share'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import { vibrate } from '../utils/haptics'
import { playSound } from '../utils/sound'

interface ShareButtonProps {
  positions: (number | null)[]
  placedCount: number
  won: boolean
  dailyDate?: string
}

export function ShareButton({ positions, placedCount, won, dailyDate }: ShareButtonProps) {
  const { copied, copy } = useCopyFeedback()

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = dailyDate
      ? buildDailyShareText(positions, placedCount, won, dailyDate, url)
      : buildShareText(positions, placedCount, won, url)

    const didCopy = await copy(text)
    if (!didCopy) return

    vibrate('copy')
    playSound('copy')
  }

  return (
    <button type="button" className="btn btn--secondary" onClick={handleShare}>
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
