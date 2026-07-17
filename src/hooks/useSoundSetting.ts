import { useCallback, useState } from 'react'
import { isSoundMuted, setSoundMuted } from '../utils/sound'

export function useSoundSetting() {
  const [muted, setMuted] = useState(isSoundMuted)

  const toggleMuted = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      setSoundMuted(next)
      return next
    })
  }, [])

  return { muted, toggleMuted }
}
