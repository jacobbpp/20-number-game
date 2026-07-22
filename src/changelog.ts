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
    version: '1.35.0',
    date: '2026-07-22',
    title: 'How far off your record',
    description: 'A free-play loss that isn\'t a new best now shows how many placements short of your record it fell, right alongside the score.',
  },
  {
    version: '1.34.0',
    date: '2026-07-22',
    title: 'Which number ended it, and a daily leaderboard',
    description: 'Any leaderboard entry now shows which number had nowhere to go. The leaderboard also gets a Daily mode, a top 10 for today\'s specific challenge, since the board size changes every day. Daily boards stay hidden until you\'ve finished today\'s attempt yourself, since the rolls are the same for everyone.',
  },
  {
    version: '1.33.0',
    date: '2026-07-21',
    title: 'One tap to the leaderboard',
    description: 'A trophy icon in the header opens the leaderboard directly, no need to go through Stats first.',
  },
  {
    version: '1.32.0',
    date: '2026-07-21',
    title: 'A real top 10, and tap to see the board',
    description: 'The leaderboard now shows the actual top 10 games, not the top 10 players, so one strong player can hold several spots if they earned them. Tap any entry to see the exact board that score was set on.',
  },
  {
    version: '1.31.0',
    date: '2026-07-19',
    title: 'A real dashboard for Insights',
    description: 'Insights is rebuilt as a dashboard: a hero row of best score, average score (with a trend arrow vs last week), and games played today with a 7-day sparkline; a 30-day calendar of games played with your busiest day ever highlighted; a bar chart across every value range; leaderboard reach chips for day, week, month, and all-time; a line chart of your best score climbing over time; and a count of games that ended exactly one placement short of your best.',
  },
  {
    version: '1.30.0',
    date: '2026-07-19',
    title: 'What came next',
    description: 'A daily challenge loss now shows the roll that ended it, plus what the next few rolls would have been and where they would have fit. The daily rolls are the same for everyone, so this is a real answer, not a guess.',
  },
  {
    version: '1.29.0',
    date: '2026-07-19',
    title: 'Insights, reimagined',
    description: 'Insights now leads with score and leaderboard reach instead of win rate, since winning outright is rare. A new Leaderboard reach card tracks how many of today\'s games made a board, and the other patterns lean less on raw win percentages.',
  },
  {
    version: '1.28.0',
    date: '2026-07-19',
    title: 'A leaderboard, arcade-style',
    description: 'A top 10 score puts up a name prompt, just like an old arcade machine. Leaderboard in Stats tracks day, week, month, and all-time boards. No sign-in, the name is just remembered on this device.',
  },
  {
    version: '1.27.2',
    date: '2026-07-19',
    title: 'A shorter share',
    description: 'The link is gone from Share too. It is just the score and the emoji grid now.',
  },
  {
    version: '1.27.1',
    date: '2026-07-19',
    title: 'Share stays as text',
    description: 'Share is back to copying the text grid only, no branded image option. Feedback was that the plain emoji grid is what people actually want to paste.',
  },
  {
    version: '1.27.0',
    date: '2026-07-19',
    title: 'A community usual spot',
    description: 'The dot marking a likely position for your roll now reflects everyone who plays, not just your own history. No sign-in, nothing personal shared, just how the rolls tend to land.',
  },
  {
    version: '1.26.0',
    date: '2026-07-19',
    title: 'A faster way to hide the home screen',
    description: 'A "Hide this screen" link now sits at the bottom of the home screen itself, right where you\'d look for it, so you don\'t need to go into Settings to turn it off.',
  },
  {
    version: '1.25.0',
    date: '2026-07-19',
    title: 'A guide to every stat and setting',
    description: '"Learn about the app" in Settings opens a plain-language guide to everything on the Stats and Settings screens, including a breakdown of each Insights pattern you can expand or collapse.',
  },
  {
    version: '1.24.0',
    date: '2026-07-19',
    title: 'A home screen, and deeper insights',
    description: 'A new "Ready to play?" screen greets you before each session, with today\'s daily challenge and your personal best and win streak front and center. Turn it off in Settings to jump straight to the board instead. Insights now leads with a best score/win rate/streak strip and adds three new patterns: your best-performing position, whether the top or bottom half of the board treats you better, and how close your current streak is to your record.',
  },
  {
    version: '1.23.0',
    date: '2026-07-19',
    title: 'Shared images match your theme',
    description: 'The image behind Share now follows whichever theme you\'re on: dark stays dark, light actually looks light, instead of always rendering the dark version.',
  },
  {
    version: '1.22.0',
    date: '2026-07-19',
    title: 'A new look',
    description: 'Order 20 now runs on the tb-dev brand: warm paper and ink tones, Hanken Grotesk headings, Space Mono for every number, and a violet-to-orange board gradient in place of the old rainbow. A small "~/order-20" mark with the Tommy badge now sits at the top of the header.',
  },
  {
    version: '1.21.0',
    date: '2026-07-19',
    title: '20 new milestone achievements',
    description: 'A new "Milestones" grid in Achievements covers every free-play score, 1/20 through 20/20. Reach a new best and it fills in. A game that crosses several at once only announces the highest one, not a toast per number.',
  },
  {
    version: '1.20.0',
    date: '2026-07-19',
    title: 'Deeper insights, and the share image is back',
    description: 'Insights is now a feed of real patterns (your best value range, toughest range, most-used position, and hard mode win rate vs overall), each shown once there\'s enough data behind it. The share image returns too, redesigned to match the board\'s own look instead of the oversized version from before.',
  },
  {
    version: '1.19.1',
    date: '2026-07-19',
    title: 'Back to plain text sharing',
    description: 'The generated share image turned out too tall in practice, so Share is back to copying the text grid, same as before v1.18.0.',
  },
  {
    version: '1.19.0',
    date: '2026-07-19',
    title: 'A placement guide, and a clearer stats page',
    description: 'Legal positions now show a dot marking where you\'ve usually placed similar numbers (off in hard mode). Stats is now a menu: Heatmap, Win rate & streak, Daily streak, Average score, and Insights each get their own screen instead of one long page.',
  },
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
    description: 'A new toggle in Settings turns off the valid-position highlight in free play and the daily challenge. Nothing tells you where a number goes. A wrong tap just does nothing.',
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
