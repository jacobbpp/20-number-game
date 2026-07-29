// The illustrated part of the guide. Diagrams rather than icons, because the
// mistake people make with a transfer code is doing it on the wrong device,
// and a picture of the code travelling left to right settles that faster than
// a sentence does.

function PhoneWithSettings() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="A phone showing the settings list, with Move my game picked out">
      <rect x="78" y="6" width="44" height="84" rx="7" fill="none" stroke="var(--text-dim)" strokeWidth="1.6" />
      <rect x="84" y="16" width="32" height="7" rx="3.5" fill="var(--text)" opacity="0.16" />
      <rect x="84" y="28" width="32" height="7" rx="3.5" fill="var(--text)" opacity="0.16" />
      <rect x="84" y="40" width="32" height="7" rx="3.5" fill="var(--cta)" opacity="0.95" />
      <rect x="84" y="52" width="32" height="7" rx="3.5" fill="var(--text)" opacity="0.16" />
      <rect x="84" y="64" width="32" height="7" rx="3.5" fill="var(--text)" opacity="0.16" />
      <circle cx="134" cy="43.5" r="9" fill="none" stroke="var(--cta)" strokeWidth="1.4" />
      <path d="M130 43.5l3 3 5-5.5" fill="none" stroke="var(--cta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneWithCode() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="A phone displaying a six character code above a clock">
      <rect x="78" y="6" width="44" height="84" rx="7" fill="none" stroke="var(--text-dim)" strokeWidth="1.6" />
      {/* Sized to the text rather than the phone: six monospace characters at
          this size need the full width of the handset to sit inside the box. */}
      <rect x="81" y="31" width="38" height="24" rx="5" fill="var(--cta)" opacity="0.14" stroke="var(--cta)" strokeWidth="1.2" />
      <text x="100" y="47" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="9" fontWeight="700" fill="var(--cta)">
        K7M2QP
      </text>
      <circle cx="100" cy="68" r="6.5" fill="none" stroke="var(--text-dim)" strokeWidth="1.3" />
      <path d="M100 64.5V68l2.5 1.8" fill="none" stroke="var(--text-dim)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function CodeTravelling() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="The code passing from the old phone on the left to the new phone on the right">
      <rect x="16" y="14" width="40" height="68" rx="6" fill="none" stroke="var(--cta)" strokeWidth="1.6" />
      <text x="36" y="52" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="8.5" fontWeight="700" fill="var(--cta)">
        K7M2QP
      </text>
      <rect x="144" y="14" width="40" height="68" rx="6" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="3.5 3" />
      <path d="M70 48h58" stroke="var(--win)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 5" />
      <path d="M124 42.5l7 5.5-7 5.5" fill="none" stroke="var(--win)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="100" y="34" textAnchor="middle" fontFamily="inherit" fontSize="8.5" fill="var(--text-dim)">
        you type it
      </text>
    </svg>
  )
}

function PhoneWithGame() {
  return (
    <svg viewBox="0 0 200 96" role="img" aria-label="The new phone now holding the stats, streak and achievements">
      <rect x="78" y="6" width="44" height="84" rx="7" fill="none" stroke="var(--win)" strokeWidth="1.6" />
      <rect x="85" y="18" width="14" height="18" rx="3" fill="var(--win)" opacity="0.5" />
      <rect x="101" y="24" width="14" height="12" rx="3" fill="var(--win)" opacity="0.3" />
      <rect x="85" y="41" width="30" height="5" rx="2.5" fill="var(--text)" opacity="0.22" />
      <rect x="85" y="49" width="22" height="5" rx="2.5" fill="var(--text)" opacity="0.22" />
      <circle cx="100" cy="70" r="10" fill="none" stroke="var(--win)" strokeWidth="1.6" />
      <path d="M95.5 70l3.2 3.2 6-6.4" fill="none" stroke="var(--win)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STEPS = [
  {
    illustration: <PhoneWithSettings />,
    title: 'Start on your old device',
    body: 'Open Settings there and choose Move my game. It has to be the device your game is actually on.',
  },
  {
    illustration: <PhoneWithCode />,
    title: 'A code appears',
    body: 'Six characters, good for fifteen minutes, and usable once. Leave the screen open while you walk to the other device.',
  },
  {
    illustration: <CodeTravelling />,
    title: 'Type it into the new one',
    body: 'On the new device, choose Move my game, pick the empty option, and enter the six characters.',
  },
  {
    illustration: <PhoneWithGame />,
    title: 'Everything lands',
    body: 'Stats, streak, achievements and your name are all on the new device. Keep playing there, and stop using the old one.',
  },
]

export function TransferGuide() {
  return (
    <div className="transfer-guide">
      {STEPS.map((step, index) => (
        <div key={step.title} className="transfer-step">
          <figure className="transfer-step__art">{step.illustration}</figure>
          <span className="transfer-step__n">{index + 1}</span>
          <p className="transfer-step__title">{step.title}</p>
          <p className="transfer-step__body">{step.body}</p>
        </div>
      ))}
    </div>
  )
}
