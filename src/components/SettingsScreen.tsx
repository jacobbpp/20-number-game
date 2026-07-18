import { useState } from 'react'
import type { Theme } from '../hooks/useTheme'
import { clearAllData } from '../utils/resetData'

interface SettingsScreenProps {
  muted: boolean
  onToggleMuted: () => void
  theme: Theme
  onToggleTheme: () => void
  hardMode: boolean
  onToggleHardMode: () => void
  showHomeScreen: boolean
  onToggleShowHomeScreen: () => void
  version: string
  onOpenChangelog: () => void
  onClose: () => void
}

export function SettingsScreen({
  muted,
  onToggleMuted,
  theme,
  onToggleTheme,
  hardMode,
  onToggleHardMode,
  showHomeScreen,
  onToggleShowHomeScreen,
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
          <span>Hard mode</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleHardMode}
            aria-label={hardMode ? 'Turn off hard mode' : 'Turn on hard mode'}
            aria-pressed={hardMode}
          >
            {hardMode ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
                <path d="M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
                <path d="M17.9 17.9C20 16.2 22 12 22 12s-1.6-2.8-4.3-4.8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <div className="settings-row">
          <span>Home screen</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleShowHomeScreen}
            aria-label={showHomeScreen ? 'Skip the home screen and jump straight into a game' : 'Show a home screen before the game'}
            aria-pressed={showHomeScreen}
          >
            {showHomeScreen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11l9-7 9 7" />
                <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4l8 8-8 8" />
                <path d="M13 4l8 8-8 8" />
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
