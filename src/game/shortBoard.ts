// Order 6: a board short enough that finishing one is a real prospect.
//
// The full board is not winnable in any practical sense. Following the
// suggested position every single turn fills all twenty about twice in forty
// thousand attempts, and across every game this app has logged it has never
// happened once. That is fine as a legend, but it left the win screen, the
// win streak and the win achievements as decoration nobody would ever see.
//
// Six is the size where that stops being true. Measured over 50,000 simulated
// games following the same hint the app shows, the win rates are:
//
//   size 4  33.9%    size 7   8.9%
//   size 5  22.3%    size 8   5.5%
//   size 6  14.1%    size 10  2.0%
//
// Six is roughly one win in seven games: an evening, not a grind, and not a
// giveaway either. Four and five are won often enough that finishing stops
// meaning anything.
export const SHORT_BOARD_SIZE = 6

// 1 / 0.141, from the table above. Stated in the reveal, so it is worth
// keeping next to the number it came from.
const SHORT_BOARD_ODDS = 'about one in seven'

export interface ShortRecord {
  games: number
  wins: number
  currentStreak: number
  bestStreak: number
}

export function createEmptyShortRecord(): ShortRecord {
  return { games: 0, wins: 0, currentStreak: 0, bestStreak: 0 }
}

export function isShortRecord(value: unknown): value is ShortRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ShortRecord>
  return (
    typeof candidate.games === 'number' &&
    typeof candidate.wins === 'number' &&
    typeof candidate.currentStreak === 'number' &&
    typeof candidate.bestStreak === 'number'
  )
}

export function recordShortGame(record: ShortRecord, won: boolean): ShortRecord {
  const currentStreak = won ? record.currentStreak + 1 : 0

  return {
    games: record.games + 1,
    wins: record.wins + (won ? 1 : 0),
    currentStreak,
    // The record survives a loss; only the running count resets.
    bestStreak: Math.max(record.bestStreak, currentStreak),
  }
}

// What the worker reports across everyone. Null when it could not be reached.
export interface CommunityRecord {
  games: number
  players: number
  wins: number
}

export interface Reveal {
  eyebrow: string
  headline: string
  lines: string[]
  offer: string
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

// The reveal states its case with real numbers, which means it has to be
// built from them rather than written out and decorated. In particular it
// must not go on claiming nobody has ever filled a board once somebody has:
// the moment that happens the joke becomes a bug, and "once, ever" is the
// better story anyway.
export function revealCopy(community: CommunityRecord | null, ownGames: number): Reveal {
  const offer = `Six positions, same rules. You will win ${SHORT_BOARD_ODDS}.`

  // No answer from the worker. The player's own history still makes the
  // point, and it needs no network to be true.
  if (!community) {
    return {
      eyebrow: 'YOU FOUND IT',
      headline: 'You have never won',
      lines: [
        ownGames > 0
          ? `${ownGames.toLocaleString()} ${plural(ownGames, 'game', 'games')} on this device. Not one full board.`
          : 'Nor has anyone else, as far as anyone can tell.',
        'That is not you being bad at it. Twenty in a row turns up about once in twenty thousand tries.',
      ],
      offer,
    }
  }

  const games = community.games.toLocaleString()
  const players = community.players

  if (community.wins === 0) {
    return {
      eyebrow: 'YOU FOUND IT',
      headline: 'Nobody has ever won',
      lines: [
        // "counted" rather than "ever": the game log started partway through
        // this app's life and does not reach back to the beginning.
        `${games} ${plural(community.games, 'game', 'games')} counted between ${players} of you. Not one full board.`,
        'That is not you being bad at it. Twenty in a row turns up about once in twenty thousand tries.',
      ],
      offer,
    }
  }

  if (community.wins === 1) {
    return {
      eyebrow: 'YOU FOUND IT',
      headline: 'It has happened. Once.',
      lines: [
        `One full board in ${games} ${plural(community.games, 'game', 'games')} between ${players} of you.`,
        'Which is about what the odds say. Twenty in a row turns up roughly once in twenty thousand tries.',
      ],
      offer,
    }
  }

  return {
    eyebrow: 'YOU FOUND IT',
    headline: `It has happened ${community.wins} times`,
    lines: [
      `${community.wins} full boards in ${games} ${plural(community.games, 'game', 'games')} between ${players} of you.`,
      'Which is ahead of the odds. Twenty in a row turns up roughly once in twenty thousand tries.',
    ],
    offer,
  }
}
