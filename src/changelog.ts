export interface ChangelogEntry {
  version: string
  date: string
  title: string
  description: string
}

// Newest first. Only user-facing changes belong here — no internal fixes,
// refactors, or polish. Dates are the day each feature actually shipped.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.18.0',
    date: '2026-07-18',
    title: 'Achievements and shareable images',
    description: 'A trophy pill on Stats opens 7 achievements to unlock, from your first win to winning with hard mode on. Sharing a result now offers a real branded image on phones that support it, not just text.',
  },
  {
    version: '1.17.0',
    date: '2026-07-18',
    title: 'Hard mode',
    description: 'A new toggle in Settings turns off the valid-position highlight in free play and the daily challenge. Nothing tells you where a number goes — a wrong tap just does nothing.',
  },
  {
    version: '1.16.0',
    date: '2026-07-18',
    title: 'Cleaner header, streak moved to stats',
    description: 'Restart, Stats, Challenges, and Settings now sit together as icons, with a ring on Challenges when today\'s is unplayed. Your daily streak now lives on the Stats screen, current and best, alongside win streak.',
  },
  {
    version: '1.15.0',
    date: '2026-07-17',
    title: 'See the full release history',
    description: 'Settings now shows the version you\'re on. Tap it to browse every past update, not just what changed since you last played.',
  },
  {
    version: '1.14.0',
    date: '2026-07-17',
    title: 'Deeper stats',
    description: 'Win streak, average turns in wins, a "how far your runs usually get" chart, and a filter to see the heatmap for wins or losses only.',
  },
  {
    version: '1.13.0',
    date: '2026-07-17',
    title: 'More stats, clearer heatmap key',
    description: 'Win rate and average turns now show at a glance, plus a note on which value range trips you up most often. The heatmap legend explains itself properly now too.',
  },
  {
    version: '1.12.0',
    date: '2026-07-17',
    title: 'Settings screen',
    description: 'Sound and theme now live together on a proper settings screen, reachable from the gear icon in the header. Added a reset-all-data option there too.',
  },
  {
    version: '1.11.0',
    date: '2026-07-17',
    title: 'Light theme',
    description: 'A light option alongside the original dark look. Matches your device setting by default, or switch it yourself from the Stats screen.',
  },
  {
    version: '1.10.0',
    date: '2026-07-17',
    title: 'See your best run',
    description: 'Tap "Best" in the header to see the actual board from your highest-scoring game, not just the number.',
  },
  {
    version: '1.9.0',
    date: '2026-07-17',
    title: 'Release notes',
    description: "You'll see this popup after an update if there's something worth knowing about, with anything you missed further down.",
  },
  {
    version: '1.8.0',
    date: '2026-07-17',
    title: 'Cleaner board',
    description: 'Position numbers now sit in their own colour, built into each row instead of a floating line down the side.',
  },
  {
    version: '1.7.0',
    date: '2026-07-17',
    title: 'Share your streak',
    description: "Tap your streak in the daily recap to share it, separate from a single day's result.",
  },
  {
    version: '1.6.0',
    date: '2026-07-17',
    title: 'Sound',
    description: 'Added sound for placing, winning, losing, and sharing, with a mute toggle in the header.',
  },
  {
    version: '1.5.0',
    date: '2026-07-17',
    title: 'Daily challenge history',
    description: 'See your last 30 days of daily attempts from the daily challenge screen.',
  },
  {
    version: '1.4.0',
    date: '2026-07-17',
    title: 'Daily challenge',
    description: 'One puzzle a day, the same for everyone, with a board size that changes daily and a streak counter for playing consecutive days.',
  },
  {
    version: '1.3.0',
    date: '2026-07-17',
    title: 'How to play',
    description: 'Added an onboarding walkthrough for new players, reachable any time from the stats screen.',
  },
  {
    version: '1.2.0',
    date: '2026-07-17',
    title: 'Share your result',
    description: 'Share a Wordle-style grid of your game after it ends.',
  },
  {
    version: '1.1.0',
    date: '2026-07-16',
    title: 'Stats',
    description: "Track where each number range tends to land across every game you've played, shown as a heatmap.",
  },
  {
    version: '1.0.0',
    date: '2026-07-16',
    title: 'Order 20',
    description: 'Roll a number, place it in ascending order across 20 positions. Fill the board to win.',
  },
]
