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

Hard mode drops the highlight entirely: no hints, just a silent no-op on a bad tap. Otherwise, among the currently-legal positions, a small dot marks the one the rolled number fits best. It's worked out from the board in front of you rather than from anyone else's history: where the number falls between its two nearest placed neighbours, mapped onto the empty slots lying between them. A 515 belongs about halfway down an empty board, but between an existing 480 and 520 it belongs near the far end of that gap. Playing that way is worth roughly one extra position a game, and still fills only about half the board on average, so the dot stays a better guess rather than an answer.

Community stats, the leaderboards, and the group activity feed are backed by a small Cloudflare Worker and D1 database (`worker/`), with no sign-in or personal data involved.

Numbers derived from wins stay off screen until something has been won. Nobody ever has on a twenty-slot board, so a hard-mode card comparing 0% against 0% concluded that hard mode "hasn't slowed you down", and a three-way heatmap filter offered one empty view, one duplicate, and the real one. Both are gated on `hasWins()` and return the moment a board is filled. The wins figure itself stays on the overview: it is the honest number, and it is load-bearing (see below). On the home screen the second stat card counts days played rather than a win streak.

## Order 6

A six-slot board, hidden behind a three-second press on the `~/order-20` wordmark in the game header. It lived on the "wins" tile in Stats first, which was a bad hiding place on a phone: a small target at the edge of a scrolling page, hard against the scrollbar, and invisible entirely until you had finished a game. The wordmark never scrolls, has nothing beside it, and is there from the first second. A twenty-slot board is not winnable in any practical sense, and across every game the app has logged it has never happened once, which left the win screen and the win streak as decoration nobody would ever see. Six is the size where that stops being true: measured over 50,000 simulated games following the same hint the app shows, it is won about one time in seven, against 33.9% at four slots and 2.0% at ten.

It keeps entirely to itself. Order 6 never reaches the leaderboard (the best-runs board ranks by share of board filled, so a 6 of 6 would sit at 100% above every real run forever), never reaches the group feed or the game log, never counts toward the main stats or the daily streak, and holds its own saved game so switching to it cannot cost anyone a twenty they were partway through. `src/App.shortBoard.test.tsx` asserts each of those.

The reveal quotes real numbers, fetched once when the press begins so the hold doubles as the loading window. It has three forms: the community count when the worker answers, the player's own history when it does not, and a different claim entirely once somebody has actually filled a board, because copy that went on insisting nobody ever had would become a bug the day one of them did.

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
