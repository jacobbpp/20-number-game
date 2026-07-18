# Adopt the TB Dev brand — agent prompt

Give this file to a coding assistant (Claude Code, Cursor, etc.) working
inside any TB Dev app. It's app-agnostic: it works for a web app, a mobile
web app, or a marketing site. (Drop it in your repo as `ADOPT-BRAND.md` and
say "follow ADOPT-BRAND.md".)

---

## Prompt

Adopt the **TB Dev brand system** in this app. The brand package lives at
`https://github.com/jacobbpp/tb-dev-brand` (files at repo root: `tokens.css`,
`components.css`, `assets/`).

**1. Add it.**
- If this is a git project: add as a submodule at `src/brand` (or `public/brand`
  for a static site):
  `git submodule add https://github.com/jacobbpp/tb-dev-brand src/brand`
- Load `tokens.css` once, globally, before any app styles — `import './brand/tokens.css'`
  in the entry file, or `<link rel="stylesheet" href="/brand/tokens.css">` in `<head>`.
- Optionally also load `components.css` for the ready-made `.tb-*` classes.

**2. Colors → tokens.** Replace hardcoded colors with the semantic tokens so the
app themes correctly. Map: page background → `var(--tb-bg)`, cards/panels/surfaces
→ `var(--tb-bg-elevated)`, primary text → `var(--tb-text)`, secondary text →
`var(--tb-text-muted)`, borders/dividers → `var(--tb-border)`. Set the HTML
`theme-color` meta to `#16131b`. Keep dark/light working — tokens flip
automatically via `prefers-color-scheme`, and can be forced with
`data-theme="dark"` / `"light"` on `<html>`.

**3. Type.** Headings and UI text in `var(--tb-font-sans)` (Hanken Grotesk).
All numbers, scores, counters, codes and timers in `var(--tb-font-mono)`
(Space Mono) with `font-variant-numeric: tabular-nums`.

**4. Accents, sparingly.** Violet (`var(--tb-accent)`) is the default action
colour (primary buttons, links, active/selected states). Orange
(`var(--tb-cta)`) is the *rare* "do it now" — at most one per screen. Everything
else stays neutral: accents should cover under ~10% of any screen, and there are
no full-colour backgrounds. Ready-made buttons: `.tb-btn tb-btn--primary`,
`--secondary`, `--ghost`, `--cta`.

**5. Chrome & icons.** Add a compact header with the Tommy badge
(`brand/assets/icon-512.png` as a rounded tile, ~32px) and the `~/tb-dev`
wordmark (`~/` in orange, `-dev` in violet). Replace the favicon and any PWA
manifest icons with the files in `brand/assets/`: `favicon-32.png`,
`favicon-16.png`, `apple-touch-icon-180.png`, and point manifest `icons` at
`icon-512.png` and `icon-512-maskable.png` (maskable has PWA safe-area padding).
On mobile keep tap targets ≥ 44px and respect safe-area insets.

**6. Copy voice.** Warm, plain, cheeky, honest. **No em dashes, no dog puns.**
Prefer short, kind, human lines over formal/system phrasing. E.g. an error
becomes "That didn't work. Try again?" rather than "Error: operation failed."

Do not change app/business logic. Match the look and feel of the TB Dev brand
guide; when in doubt, prefer neutrals and let one violet action plus one orange
CTA carry the screen.

---

_TB Dev · brand adoption prompt v1.0_
