import { useState } from 'react'
import type { Theme } from '../hooks/useTheme'
import { clearAllData } from '../utils/resetData'

interface SettingsScreenProps {
  muted: boolean
  onToggleMuted: () => void
  theme: Theme
  onToggleTheme: () => void
  version: string
  onOpenChangelog: () => void
  onClose: () => void
}

export function SettingsScreen({
  muted,
  onToggleMuted,
  theme,
  onToggleTheme,
  version,
  onOpenChangelog,
  onClose,
}: SettingsScreenProps) {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  const handleConfirmReset = () => {
    clearAllData()
    window.location.reload()
  }

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="settings-screen__title">Settings</span>
      </div>

      <div className="settings-screen__body">
        <div className="settings-row">
          <span>Sound</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleMuted}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            aria-pressed={muted}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9v6h4l5 5V4L8 9H4z" />
                <path d="M16 9l5 5" />
                <path d="M21 9l-5 5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 9v6h4l5 5V4L8 9H4z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            )}
          </button>
        </div>

        <div className="settings-row">
          <span>Theme</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6 19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4 19 5" />
              </svg>
            )}
          </button>
        </div>

        <div className="settings-row">
          <span>Version</span>
          <button type="button" className="pill header__best" onClick={onOpenChangelog} aria-label={`Version ${version}. View release notes`}>
            v{version}
          </button>
        </div>

        <div className="settings-divider" />

        {isConfirmingReset ? (
          <div className="settings-reset settings-reset--confirm">
            <p className="settings-reset__body">
              Reset everything? This clears your best score, stats, streak, and preferences and can't be undone.
            </p>
            <div className="settings-reset__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setIsConfirmingReset(false)} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={handleConfirmReset}>
                Yes, reset
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-reset">
            <p className="settings-reset__title">Reset all data</p>
            <p className="settings-reset__body">Clears your best score, stats, streak, and preferences. This can't be undone.</p>
            <button type="button" className="btn btn--danger-outline" onClick={() => setIsConfirmingReset(true)}>
              Reset all data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
