import { Board } from './Board'
import { RollDisplay } from './RollDisplay'
import { suggestedPosition } from '../game/hint'
import { SHORT_BOARD_SIZE, type ShortRecord } from '../game/shortBoard'
import type { GameState } from '../game/types'

interface ShortBoardScreenProps {
  state: GameState
  record: ShortRecord
  hardMode: boolean
  onSelect: (index: number) => void
  onRestart: () => void
  onClose: () => void
}

export function ShortBoardScreen({ state, record, hardMode, onSelect, onRestart, onClose }: ShortBoardScreenProps) {
  const finished = state.status === 'won' || state.status === 'lost'
  const suggestion =
    state.currentRoll !== null ? suggestedPosition(state.positions, state.currentRoll, state.validPositions) : null

  return (
    <div className="short-screen">
      <div className="short-screen__header">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to game">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="short-screen__title">Order {SHORT_BOARD_SIZE}</span>
        <span className="short-screen__record">
          {record.wins} of {record.games}
        </span>
      </div>

      {/* Header stays put; everything else sits centred in what is left. Six
          slots do not need the whole screen, and the answer to a board that
          was too small is not a board stretched to three times the row height
          of every other one in the app. */}
      <div className="short-screen__content">
      {finished ? (
        <div className={`short-result${state.status === 'won' ? ' short-result--won' : ''}`}>
          <p className="short-result__eyebrow">{state.status === 'won' ? `ORDER ${SHORT_BOARD_SIZE} COMPLETE` : 'NO LEGAL POSITION'}</p>
          <p className="short-result__score">
            {state.placedCount} of {SHORT_BOARD_SIZE}
          </p>
          <p className="short-result__body">
            {state.status === 'won'
              ? 'The whole board, in order.'
              : (state.lossReason ?? 'Nothing left that the roll could legally go into.')}
          </p>
          <button type="button" className="btn btn--primary" onClick={onRestart} autoFocus>
            {state.status === 'won' ? 'Again' : 'Try again'}
          </button>
          <p className="short-result__record">
            {record.wins} {record.wins === 1 ? 'win' : 'wins'} from {record.games}
            {record.bestStreak > 1 ? `, best run of ${record.bestStreak}` : ''}
          </p>
        </div>
      ) : (
        <RollDisplay currentRoll={state.currentRoll} placedCount={state.placedCount} total={SHORT_BOARD_SIZE} />
      )}

      <Board
        positions={state.positions}
        validPositions={finished ? [] : state.validPositions}
        hardMode={hardMode}
        suggestedPosition={finished ? null : suggestion}
        onSelect={onSelect}
      />
      </div>
    </div>
  )
}
