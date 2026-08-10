import type { PushAvailability } from '../game/push'

interface NotificationsScreenProps {
  availability: PushAvailability
  enabled: boolean
  busy: boolean
  error: string | null
  onEnable: () => void
  onDisable: () => void
  onClose: () => void
}

// Diagrams rather than icons, for the same reason the transfer guide has
// them: the thing people get stuck on is finding the Share button and then
// scrolling far enough down the sheet, and a picture of where to look settles
// that faster than a sentence naming it.

function SafariShareButton() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="A phone in Safari with the share button at the bottom circled">
      <rect x="78" y="4" width="44" height="88" rx="7" fill="none" stroke="var(--text-dim)" strokeWidth="1.6" />
      <rect x="84" y="12" width="32" height="52" rx="4" fill="var(--text)" opacity="0.08" />
      <rect x="84" y="70" width="32" height="14" rx="4" fill="var(--text)" opacity="0.14" />
      {/* The share glyph itself: a box with an arrow leaving the top. */}
      <path d="M100 80v-9" fill="none" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M97 74l3-3 3 3" fill="none" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M95.5 77v5.5h9V77" fill="none" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="100" cy="77" r="12" fill="none" stroke="var(--cta)" strokeWidth="1.4" strokeDasharray="3 2.5" />
      <path d="M138 77h-22" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M121 72.5l-5 4.5 5 4.5" fill="none" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="142" y="80" fontFamily="inherit" fontSize="8.5" fill="var(--text-dim)">
        tap here
      </text>
    </svg>
  )
}

function ShareSheetMenu() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="The share sheet open, with Add to Home Screen highlighted partway down the list">
      <rect x="60" y="8" width="80" height="80" rx="8" fill="none" stroke="var(--text-dim)" strokeWidth="1.6" />
      <rect x="68" y="17" width="46" height="6" rx="3" fill="var(--text)" opacity="0.16" />
      <rect x="68" y="29" width="52" height="6" rx="3" fill="var(--text)" opacity="0.16" />
      <rect x="65" y="40" width="70" height="15" rx="5" fill="var(--cta)" opacity="0.16" stroke="var(--cta)" strokeWidth="1.2" />
      <text x="72" y="50" fontFamily="inherit" fontSize="7.5" fontWeight="700" fill="var(--cta)">
        Add to Home Screen
      </text>
      <rect x="68" y="61" width="44" height="6" rx="3" fill="var(--text)" opacity="0.16" />
      <rect x="68" y="73" width="50" height="6" rx="3" fill="var(--text)" opacity="0.16" />
    </svg>
  )
}

function IconOnHomeScreen() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="The Order 20 icon now sitting on the home screen among other apps">
      <rect x="72" y="6" width="56" height="84" rx="8" fill="none" stroke="var(--win)" strokeWidth="1.6" />
      <rect x="80" y="18" width="16" height="16" rx="5" fill="var(--text)" opacity="0.14" />
      <rect x="104" y="18" width="16" height="16" rx="5" fill="var(--text)" opacity="0.14" />
      <rect x="80" y="42" width="16" height="16" rx="5" fill="var(--accent)" />
      <text x="88" y="53.5" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="8" fontWeight="700" fill="var(--accent-on)">
        20
      </text>
      <rect x="104" y="42" width="16" height="16" rx="5" fill="var(--text)" opacity="0.14" />
      <circle cx="88" cy="70" r="7.5" fill="none" stroke="var(--win)" strokeWidth="1.5" />
      <path d="M84.6 70l2.4 2.4 4.4-4.8" fill="none" stroke="var(--win)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const INSTALL_STEPS = [
  {
    illustration: <SafariShareButton />,
    title: 'Tap Share in Safari',
    body: 'The square with an arrow coming out of it, along the bottom of the screen.',
  },
  {
    illustration: <ShareSheetMenu />,
    title: 'Choose Add to Home Screen',
    body: 'It sits partway down the list, so you will need to scroll a little. Then tap Add.',
  },
  {
    illustration: <IconOnHomeScreen />,
    title: 'Open it from the icon',
    body: 'Use that icon from now on rather than the Safari tab. Come back here and the reminder can be turned on.',
  },
]

function Bell() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" role="img" aria-label="A bell" className="reminder-hero__bell">
      <path
        d="M24 6a12 12 0 0 0-12 12v8l-4 6h32l-4-6v-8A12 12 0 0 0 24 6z"
        fill="none"
        stroke="var(--cta)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M19 36a5 5 0 0 0 10 0" fill="none" stroke="var(--cta)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function NotificationsScreen({
  availability,
  enabled,
  busy,
  error,
  onEnable,
  onDisable,
  onClose,
}: NotificationsScreenProps) {
  const canSwitch = availability === 'available'

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="settings-screen__title">Daily reminder</span>
      </div>

      <div className="settings-screen__body">
        {availability === 'needs-install' ? (
          <>
            <div className="reminder-gate">
              <p className="reminder-gate__title">Add Order 20 to your Home Screen first</p>
              <p className="reminder-gate__body">
                iPhone and iPad only send notifications to apps that live on the Home Screen, not to pages open in
                Safari. It takes about ten seconds.
              </p>
            </div>

            <div className="install-guide">
              {INSTALL_STEPS.map((step, index) => (
                <div key={step.title} className="install-step">
                  <figure className="install-step__art">{step.illustration}</figure>
                  <span className="install-step__n">{index + 1}</span>
                  <p className="install-step__title">{step.title}</p>
                  <p className="install-step__body">{step.body}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="reminder-hero">
              <Bell />
              <p className="reminder-hero__title">A nudge each morning</p>
              <p className="reminder-hero__body">
                One notification a day, at 9am, when the new daily challenge lands.
              </p>
            </div>

            {availability === 'available' ? (
              <div className="settings-row reminder-switch">
                <span className="reminder-switch__label">
                  Daily reminder
                  <span className={`reminder-switch__state${enabled ? ' reminder-switch__state--on' : ''}`}>
                    {busy ? 'Just a moment' : enabled ? 'On' : 'Off'}
                  </span>
                </span>
                <button
                  type="button"
                  className={`reminder-toggle${enabled ? ' reminder-toggle--on' : ''}`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Daily reminder"
                  disabled={busy}
                  onClick={enabled ? onDisable : onEnable}
                >
                  <span className="reminder-toggle__knob" />
                </button>
              </div>
            ) : null}

            {availability === 'blocked' ? (
              <div className="reminder-gate">
                <p className="reminder-gate__title">Notifications are turned off for this app</p>
                <p className="reminder-gate__body">
                  That choice is held by the browser rather than the game, so it cannot be undone from here. Allow
                  notifications for Order 20 in your browser or system settings, then come back.
                </p>
              </div>
            ) : null}

            {availability === 'unsupported' ? (
              <div className="reminder-gate">
                <p className="reminder-gate__title">This browser cannot do reminders</p>
                <p className="reminder-gate__body">
                  Nothing is wrong. Everything else in the game works exactly as it does anywhere else, and the daily
                  challenge is waiting whenever you open it.
                </p>
              </div>
            ) : null}

            {error ? <p className="reminder-error">{error}</p> : null}

            {canSwitch ? (
              <>
                <p className="reminder-list__label">What you get</p>
                <ul className="reminder-list">
                  <li className="reminder-list__item">A reminder that today's challenge is up</li>
                  <li className="reminder-list__item">Who won yesterday, and the score they did it with</li>
                  <li className="reminder-list__item reminder-list__item--never">
                    Nothing else, ever. No alerts when somebody beats you.
                  </li>
                </ul>

                <p className="reminder-note">
                  Skipped entirely on a morning you have already played. Turn it off here any time.
                </p>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
