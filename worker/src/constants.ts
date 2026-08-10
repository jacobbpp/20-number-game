// Values that index.ts needs to share with its tests, kept out of index.ts
// itself.
//
// The entrypoint's named exports are not ordinary module exports: the runtime
// reads them looking for Durable Object classes and entrypoint handlers, and
// rejects anything that is not callable. `wrangler dev` fails outright with
// "Incorrect type for map entry ... not of type 'function or ExportedHandler'"
// the moment a plain string or array is exported from there. Deploys have
// tolerated it, which is exactly why it went unnoticed.

// Ten past midnight UTC: the day being summarised has ended and every game
// for it is in.
export const ROLLUP_CRON = '10 0 * * *'

// 08:00 UTC, which is 9am British summer time and 8am in winter. Early enough
// to catch the morning, late enough not to wake anyone.
export const REMINDER_CRON = '0 8 * * *'

// The four reactions the feed accepts. A fixed set rather than free text, so
// there is nothing to moderate.
export const REACTION_EMOJI = ['\u{1F44F}', '\u{1F525}', '\u{1F631}', '\u{1F602}']
