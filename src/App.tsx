import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import { GameOverScreen } from './components/GameOverScreen'
import { Header } from './components/Header'
import { RollDisplay } from './components/RollDisplay'
import { WinScreen } from './components/WinScreen'
import { place, roll } from './game/engine'
import { BOARD_SIZE, createInitialState } from './game/types'
import { useBestScore } from './hooks/useBestScore'
import { vibrate } from './utils/haptics'

function startGame() {
  return roll(createInitialState())
}

function App() {
  const [state, setState] = useState(startGame)
  const [gameId, setGameId] = useState(0)
  const { bestScore, reportScore } = useBestScore()
  const prevPlacedRef = useRef(state.placedCount)

  useEffect(() => {
    if (state.status === 'won') {
      vibrate('win')
      reportScore(state.placedCount)
    } else if (state.status === 'lost') {
      vibrate('lose')
      reportScore(state.placedCount)
    }
  }, [state.status, state.placedCount, reportScore])

  useEffect(() => {
    if (state.placedCount > prevPlacedRef.current) vibrate('place')
    prevPlacedRef.current = state.placedCount
  }, [state.placedCount])

  const handleSelect = (index: number) => {
    setState(prev => {
      const placed = place(prev, index)
      if (placed === prev || placed.status !== 'idle') return placed
      return roll(placed)
    })
  }

  const handleRestart = () => {
    setState(startGame())
    setGameId(id => id + 1)
  }

  return (
    <div className="app">
      <Header bestScore={bestScore} onRestart={handleRestart} />
      <RollDisplay currentRoll={state.currentRoll} placedCount={state.placedCount} total={BOARD_SIZE} />
      <Board
        key={gameId}
        positions={state.positions}
        validPositions={state.validPositions}
        onSelect={handleSelect}
      />

      {state.status === 'lost' && (
        <GameOverScreen
          reason={state.lossReason ?? 'No legal position remained for the rolled number.'}
          placedCount={state.placedCount}
          bestScore={bestScore}
          onNewGame={handleRestart}
        />
      )}
      {state.status === 'won' && <WinScreen onNewGame={handleRestart} />}
    </div>
  )
}

export default App
