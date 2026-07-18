# TB Dev — Brand Package

Tommy Boy Dev's shared look, in code. Drop this into any app and it
instantly matches the family: soft violet + warm orange accents on warm
neutrals, Space Mono + Hanken Grotesk, and Tommy on the icon.

The full visual guide (logo rules, color ratios, voice) lives in
`TB Dev Brand Guide` — this folder is the part your apps actually *use*.

```
brand/
├─ tokens.css        ← colors, type, spacing, shape (light + dark)  ← the core
├─ components.css    ← optional ready-made .tb-* classes
└─ assets/
   ├─ icon-512.png              app icon / PWA / repo avatar
   ├─ icon-512-maskable.png     PWA maskable (has safe-area padding)
   ├─ apple-touch-icon-180.png
   ├─ favicon-32.png  favicon-16.png
   ├─ tommy-head-orange.png     Tommy's face, brand orange (for tiles)
   ├─ tommy-full-orange.png     full silhouette
   ├─ tommy-head-white.png / tommy-full-cream.png  (reversed uses)
   └─ tommy-mask.png            recolor Tommy any color (CSS mask)
```

---

## Quick start (any app)

1. Copy the `brand/` folder into your project (e.g. `src/brand/` or `public/brand/`).
2. Load the CSS once, globally:
   ```html
   <link rel="stylesheet" href="/brand/tokens.css">
   <link rel="stylesheet" href="/brand/components.css"> <!-- optional -->
   ```
   or in a bundler (Vite/React): `import './brand/tokens.css'` in your entry file.
3. Add the icons to your `<head>`:
   ```html
   <link rel="icon" type="image/png" sizes="32x32" href="/brand/assets/favicon-32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/brand/assets/favicon-16.png">
   <link rel="apple-touch-icon" href="/brand/assets/apple-touch-icon-180.png">
   <meta name="theme-color" content="#16131b">
   ```
4. Build UI with the tokens (not hardcoded hex):
   ```css
   .my-thing { background: var(--tb-bg-elevated); color: var(--tb-text);
               border: 1px solid var(--tb-border); border-radius: var(--tb-radius-lg); }
   ```
   or the ready-made classes: `<button class="tb-btn tb-btn--primary">Play</button>`

### Dark mode
Automatic from the device. To let users pick, set `data-theme` on `<html>`:
```js
document.documentElement.dataset.theme = 'dark';   // or 'light', or remove to follow device
```

### The one rule that matters
Violet and orange are **accents**. Neutrals should cover ~90% of any screen.
Orange (`--tb-cta`) is the *rare* "do it now" button — one per screen at most.

---

## Getting Order 20 onto the guide

Order 20 today: React + TS + Vite PWA, mobile-first, neutral slate theme
(`theme-color #1e2327`), no brand accent, no Tommy. Here's the migration,
in order of impact:

- [ ] **Add the package.** Copy `brand/` in, `import './brand/tokens.css'`
      in `src/main.tsx`.
- [ ] **Swap fonts.** Headings/UI → Hanken Grotesk. Every **number, score and
      counter** → Space Mono (`var(--tb-font-mono)` or `.tb-num`). The 1–1000
      rolls and the 20 slots are the heart of the game; mono makes them feel like it.
- [ ] **Replace hardcoded colors with tokens.** Map your slate palette:
      page bg → `var(--tb-bg)`, cards/slots → `var(--tb-bg-elevated)`,
      text → `var(--tb-text)`, borders → `var(--tb-border)`.
      Update `theme-color` meta `#1e2327` → `#16131b`.
- [ ] **Add accent moments.** Filled slots / valid placement → violet
      (`--tb-accent`). The **Roll** button is the perfect single orange CTA
      (`.tb-btn--cta`) — the "do it now" of the game. Keep everything else neutral.
- [ ] **Brand the chrome.** Put the Tommy badge + `~/tb-dev` wordmark in the
      header. Swap the favicon + PWA icons for the ones in `assets/`
      (update `manifest.webmanifest` `icons` to point at `icon-512.png` and
      `icon-512-maskable.png`).
- [ ] **Rewrite the copy** in the TB voice (warm, plain, cheeky, honest, and
      **no em dashes, no dog puns**):
      - lose message → `"One bad roll and the run's over. Go again?"`
      - streak → `"Nice, 12 placed. Tommy's impressed."`
      - win → `"All 20, in order. Good game."`

Connect GitHub and I'll turn this checklist into exact file-by-file diffs / a PR.

---

## How to store & reuse it (pick one)

**A. Its own GitHub repo — recommended.** Create `tb-dev/brand` (or
`tb-dev-brand`). Each app pulls it in one of these ways:
  - *Copy* the `brand/` folder in (simplest; re-copy when it changes).
  - *Git submodule*: `git submodule add https://github.com/tb-dev/brand src/brand`
    then `git submodule update --remote` to pull updates.
  - *Install from GitHub* (if you make it an npm package):
    `npm i github:tb-dev/brand` and `import '@tb-dev/brand/tokens.css'`.

**B. Zip.** Fine for a couple of apps: keep `brand.zip`, unzip into each project.
No versioning or update path though.

For your setup (solo, a handful of fun apps), **a `brand` repo consumed by
copy or submodule** is the sweet spot: one place to change a color, every app
picks it up.

_Brand Package v1.0 · Tommy Boy Dev_
