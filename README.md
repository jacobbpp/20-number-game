# Order 20

A mobile-first puzzle game. Roll a random number from 1 to 1,000 and place it into one of 20
empty positions so that every position stays in ascending order from top to bottom. Place all 20
correctly to win — one illegal roll ends the run.

## Rules

- A random whole number between 1 and 1,000 rolls automatically at the start of each game, and
  again after every placement. Numbers never repeat within a game.
- Tap one of the highlighted positions to place the current number there.
- A position only accepts a number if it is greater than every occupied position above it and
  lower than every occupied position below it.
- Once placed, a number cannot be moved.
- If the rolled number has no legal position, the game ends immediately.
- Fill all 20 positions to win.
- Hard mode (Settings) removes the highlight — every empty position looks the same, and it's on
  you to work out where the number legally goes. A wrong tap just does nothing; there's no penalty
  for guessing.
- Among the currently-legal positions, the one you've historically placed similar numbers at most
  often gets a small dot — a nudge among genuine choices, not a hint about legality itself. It only
  appears once there's enough history behind it, and never in hard mode. Free play only — daily
  board sizes vary, so a "usual spot" wouldn't mean the same thing from one day to the next.

A Share button on the win/loss screen produces a Wordle-style text grid by default. On phones that
support sharing files (most modern ones), it instead opens the native share sheet with a generated
image of the board, styled to match the board itself — and falls back to the copyable text
everywhere else.

Your best score (most positions filled across all attempts) is saved on this device, along with
the board from that specific run — tap the Best pill in the header to see it. A short "What's
new" summary appears after an update if anything shipped since you last played, with older
entries available further down. The full release history is always available too — the version
number in Settings opens the same view with every past update, not just what's unseen.

The stats screen (bar-chart icon in the header) is a menu — Heatmap, Win rate & streak, Daily
streak, Average score, and Insights — each row showing a live preview of that category and opening
its own screen with a back arrow that returns to the menu, not out to the game. Win rate & streak
covers win rate and win streak (plus your best-ever streak, once you've broken one). Daily streak
mirrors that for the daily challenge (current and best). Average score shows average turns per
game, overall and for wins only, alongside a chart of how far your runs usually get. Heatmap tracks
which value range tends to land at which position across every completed game, with the most
recent game's placements outlined, filterable to wins-only or losses-only. Insights is a feed of
independent observations, each gated on its own data threshold so a newer player just sees fewer
cards rather than a shaky one: your best-associated value range (highest share of placements ending
in a win), your toughest range (most common cause of a loss), your most-used position, your win
rate with hard mode on versus overall, and whether the last game followed or broke the usual
pattern.

A trophy pill on that same screen ("3/7", etc.) opens the achievements list — first win, win
streaks, games-played milestones, a daily-streak milestone, and one for winning with hard mode on.
Unlocking one shows a brief toast rather than interrupting whatever's on screen, and a device
already past an achievement's threshold when this feature first arrived credits it silently rather
than firing off a toast for every past achievement at once.

## Daily challenge

The calendar icon in the header gives one shot per day at a puzzle with the same sequence of rolls
for every player — the rolls are drawn from a deterministic generator seeded by the date, not
`Math.random`, so a given calendar day always produces the same sequence for everyone. A ring
around the icon means today's hasn't been played yet. The board size also varies by day (10, 15,
25, or 30 positions, picked the same deterministic way, and deliberately never 20 — that's free
play's size), so different days are genuinely different challenges rather than the same game as
free play with synchronized numbers. Once played, the
icon's ring clears and opening it shows a recap of the day's result for the rest of the day; the
Share button on it produces a date-labeled result separate from the free-play share text. Playing
on consecutive days (win or lose — an honest attempt is what counts) builds a streak, shown in the
recap once it reaches 2 days with its own share button, and tracked (current and best) on the
Stats screen; missing a day resets it quietly on the next play, with no "streak lost" moment. The
last 30 days of attempts are available from a "View history" toggle in the recap. Free play and
the daily challenge track separate best scores, streak data, and stats — a completed daily doesn't
feed the free-play heatmap, since "landed at position 5" means something different on a 10-slot
board than a 30-slot one.

## Settings

The gear icon in the header opens sound, theme, and data controls:

- **Sound** — mutes or unmutes the placement, win, loss, and share effects.
- **Theme** — switches between dark and light. Defaults to the device's own light/dark setting
  until changed here, then remembers the explicit choice.
- **Hard mode** — turns off the valid-position highlight in both free play and the daily
  challenge, so nothing tells you where a number can legally go.
- **Version** — shows the installed version; tap it to browse the full release history.
- **Reset all data** — clears every saved score, stat, streak, and preference on this device.
  Requires a second tap to confirm.

## Tech stack

- React + TypeScript + Vite
- Vitest for automated tests
- `vite-plugin-pwa` for installable, offline-capable PWA support

Game logic lives entirely in [`src/game/`](src/game) as plain, framework-free TypeScript
(`engine.ts`, `types.ts`, `stats.ts`, `daily.ts`, `share.ts`). Presentation components in
[`src/components/`](src/components) only render state and call back into the engine — no rules
are duplicated in the UI layer.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`, or the port configured in
`vite.config.ts`).

## Testing

```bash
npm test        # run once
npm run test:watch   # watch mode
```

Tests cover: valid placement, invalid placement, duplicate-number prevention, winning, and losing
(see [`src/game/engine.test.ts`](src/game/engine.test.ts)); the value-bucket heatmap and
last-game insight logic ([`src/game/stats.test.ts`](src/game/stats.test.ts)); the daily seeded
generator and streak math ([`src/game/daily.test.ts`](src/game/daily.test.ts)); and App-level
integration behavior — auto-roll, single game-over trigger, single stats-recording per completed
game ([`src/App.test.tsx`](src/App.test.tsx)).

## Type checking & build

```bash
npx tsc -b       # type check only
npm run build    # type check + production build to dist/
npm run preview  # serve the production build locally
```

## Deployment

`npm run build` outputs a static site in `dist/`, including a generated service worker and web
manifest. Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages,
S3 + CloudFront, etc.) — no server-side code is required.

To install as a home-screen app, open the deployed URL on a mobile device and use the browser's
"Add to Home Screen" / "Install app" option.
