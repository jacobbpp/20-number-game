# Order 20

Roll a number. Place it in order. One wrong move ends the run.

Part of the tb-dev brand.

## Rules

- Numbers roll automatically, 1 to 1,000, no repeats within a game.
- Tap a highlighted position to place the roll there.
- A position only takes a number higher than everything above it and lower than everything below it.
- Once placed, a number stays put.
- No legal position for a roll ends the game.
- Fill all 20 to win.

Hard mode drops the highlight entirely: no hints, just a silent no-op on a bad tap. Otherwise, among the currently-legal positions, a small dot marks where similar numbers usually land across everyone who plays, backed by a small Cloudflare Worker and D1 database (`worker/`), no sign-in or personal data involved.

## Home screen

"Ready to play?" greets you on launch: a Play button, today's daily challenge, and your best score and win streak. Hide it from Settings, or right from the screen itself.

## Daily challenge

One shared puzzle a day, same rolls for everyone. Board size shifts daily (10, 15, 25, or 30, never 20) so it never doubles as free play. Streaks track consecutive days played, win or lose, with 30 days of history on tap.

A loss shows the roll that ended it, plus what the next few rolls would have been and where (if anywhere) they'd have fit. Since everyone gets the same rolls for the day, that's a real answer rather than a guess.

## Stats

Heatmap, win rate, streak, average score, and Insights, each its own screen. Insights is a dashboard: a hero row of best score, average score (with a trend arrow vs last week), and games played today with a 7-day sparkline; a 30-day calendar of games played with the busiest day ever highlighted; a bar chart of win rate across every value range, with a "Practice" button that starts a free-play game weighted toward the toughest one (a real game that counts normally, just nudged); leaderboard reach chips for day, week, month, and all-time; a line chart of best score climbing over time; a closest-calls count for games that ended exactly one placement short of the best; then patterns as they earn enough games behind them: best position, board half, signature position, hard mode, streak momentum, last game.

Achievements sit behind the trophy pill: a milestone for every free-play score, 1 through 20, plus named ones for streaks, games played, and hard mode wins.

Leaderboard tracks the top 10 free-play scores by day, week, month, and all time, plus a Daily mode for today's specific challenge (board size changes every day, so daily scores only compare against the same day). A score that makes the cut prompts for a name, arcade-style, no sign-in, just remembered on this device for next time. The board is genuinely the top 10 games, not the top 10 players, so one strong run can hold several spots. Tap any entry to see the actual board it was set on, including which number ended the run. Daily boards only reveal that detail once the viewer has finished today's own attempt, since the rolls are identical for everyone and would otherwise spoil the challenge. A Streaks mode ranks whoever currently has the longest active daily-challenge streak (played today or yesterday) — a single all-time list, since a running streak doesn't reset by day/week/month the way a score does. A trophy icon in the header opens it directly, no need to go through Stats first.

## Settings

- **Sound** mutes effects.
- **Theme** switches dark and light.
- **Hard mode** turns off the placement highlight.
- **Home screen** toggles the landing screen.
- **Daily reminder** sends one notification a morning when the new challenge lands.
- **Version** shows the changelog.
- **Learn about the app** opens a guide to every stat and setting.
- **Reset all data** wipes this device.

The daily reminder is off until it's asked for. Turned on, it delivers a single notification at 9am saying the new challenge is ready and who won yesterday, and nothing else: no alerts when somebody beats a score, and a morning that's already been played is skipped. Delivery runs from a scheduled Cloudflare Worker using Web Push with a VAPID-signed, bodyless message; the wording is assembled on the device when the notification is shown, so no payload has to be encrypted per subscription and the text reflects the standings at the moment it's read. iOS and iPadOS only expose the Push API to apps launched from the Home Screen, so the screen detects that case and walks through Add to Home Screen instead of offering a switch that would fail.

## Sharing

Share a result as a Wordle-style emoji grid, copied straight to your clipboard.
