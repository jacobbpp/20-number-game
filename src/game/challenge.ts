import { createSeededRng } from './daily'

// A head to head on one shared board.
//
// The daily challenge already proves the idea: a seeded generator turns a
// string into a fixed sequence of rolls, so everybody gets the same game. A
// challenge does the same thing with its own code instead of the date, which
// means the board never has to be sent anywhere. Both phones build it from
// six characters, and the server only ever holds the two scores.

// Free play's size, so a challenge reads as a proper game rather than a
// variant. The daily deliberately avoids 20; this deliberately uses it.
export const CHALLENGE_BOARD_SIZE = 20

// No 0/O and no 1/I/L. These get read aloud and copied by eye, exactly like
// a transfer code.
export const CHALLENGE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CHALLENGE_CODE_LENGTH = 6

export const CHALLENGE_CODE_PATTERN = new RegExp(`^[${CHALLENGE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`)

export function isChallengeCode(value: string): boolean {
  return CHALLENGE_CODE_PATTERN.test(value)
}

// Typed by a person, so read it the way a person would write it.
export function normaliseCode(value: string): string {
  return value.trim().toUpperCase()
}

// Minted here rather than by the worker so a code only ever exists once a
// game has actually been finished, and an abandoned challenge leaves nothing
// behind. The alphabet is 31 characters over six places, so two people
// colliding is not a practical concern, and the server's primary key would
// catch it if they did.
export function mintChallengeCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CHALLENGE_CODE_LENGTH; i++) {
    code += CHALLENGE_ALPHABET[Math.floor(random() * CHALLENGE_ALPHABET.length)]
  }
  return code
}

// Prefixed so a code can never accidentally produce the same rolls as a date
// with the same characters, the way getDailyBoardSize keeps its own hash
// apart from the roll sequence.
export function createChallengeRng(code: string): () => number {
  return createSeededRng(`challenge:${code}`)
}

export interface ChallengeRecord {
  code: string
  boardSize: number
  challengerName: string
  // Hidden from the opponent until they have played, so knowing the target
  // cannot change how they play it. The daily hides other people's boards
  // for the same reason.
  challengerScore: number | null
  opponentName: string | null
  opponentScore: number | null
}

export type ChallengeOutcome = 'won' | 'lost' | 'level'

export function outcomeOf(mine: number, theirs: number): ChallengeOutcome {
  if (mine > theirs) return 'won'
  if (mine < theirs) return 'lost'
  return 'level'
}

export function describeOutcome(outcome: ChallengeOutcome, mine: number, theirs: number, boardSize: number): string {
  const gap = Math.abs(mine - theirs)
  const places = `${gap} ${gap === 1 ? 'place' : 'places'}`

  if (outcome === 'level') {
    return `The same ${boardSize} rolls, and you both placed ${mine}.`
  }
  if (outcome === 'won') {
    return `The same ${boardSize} rolls. You placed ${places} more.`
  }
  return `The same ${boardSize} rolls. They placed ${places} more.`
}

// Whether both sides are in and the result can be shown.
export function isSettled(record: ChallengeRecord): boolean {
  return record.challengerScore !== null && record.opponentScore !== null
}
