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

Your best score (most positions filled across all attempts) is saved on this device. The stats
screen (bar-chart icon in the header) also tracks, across every completed game, which value range
tends to land at which position — shown as a heatmap with the most recent game's placements
outlined, plus a one-line callout on whether the last game followed or broke the pattern.

## Tech stack

- React + TypeScript + Vite
- Vitest for automated tests
- `vite-plugin-pwa` for installable, offline-capable PWA support

Game logic lives entirely in [`src/game/`](src/game) as plain, framework-free TypeScript
(`engine.ts`, `types.ts`, `stats.ts`). Presentation components in [`src/components/`](src/components)
only render state and call back into the engine — no rules are duplicated in the UI layer.

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
(see [`src/game/engine.test.ts`](src/game/engine.test.ts)), plus the value-bucket heatmap and
last-game insight logic (see [`src/game/stats.test.ts`](src/game/stats.test.ts)).

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
