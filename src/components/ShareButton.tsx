import { buildDailyShareText, buildShareText, formatDailyDateLabel } from '../game/share'
import { useCopyFeedback } from '../hooks/useCopyFeedback'
import type { Theme } from '../hooks/useTheme'
import { vibrate } from '../utils/haptics'
import { buildShareImageBlob } from '../utils/shareImage'
import { playSound } from '../utils/sound'

interface ShareButtonProps {
  positions: (number | null)[]
  placedCount: number
  won: boolean
  dailyDate?: string
  theme: Theme
}

// Checked with a throwaway probe file, before spending time generating the
// real image, so unsupported browsers (most desktop ones today) skip the
// canvas work entirely and go straight to the existing copy-text path.
async function supportsFileShare(): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

export function ShareButton({ positions, placedCount, won, dailyDate, theme }: ShareButtonProps) {
  const { copied, copy } = useCopyFeedback()

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}`
    const text = dailyDate
      ? buildDailyShareText(positions, placedCount, won, dailyDate, url)
      : buildShareText(positions, placedCount, won, url)

    if (await supportsFileShare()) {
      const headline = dailyDate ? `Order 20 Daily · ${formatDailyDateLabel(dailyDate)}` : 'Order 20'
      const blob = await buildShareImageBlob({ positions, placedCount, won, headline, url, theme })
      const file = blob ? new File([blob], 'order-20.png', { type: 'image/png' }) : null

      if (file) {
        try {
          await navigator.share({ files: [file], text })
          return
        } catch (err) {
          // The player closing the native share sheet is a deliberate
          // choice, not a failure — don't fall back to copying in that
          // case. Any other error (permissions, a mid-flight capability
          // change, etc.) falls through to the copy-text path below.
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
    }

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
