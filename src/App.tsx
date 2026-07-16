import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { Controls } from './components/Controls'
import { GameOverScreen } from './components/GameOverScreen'
import { Header } from './components/Header'
import { RollDisplay } from './components/RollDisplay'
import { WinScreen } from './components/WinScreen'
import { place, restart, roll } from './game/engine'
import { BOARD_SIZE, createInitialState } from './game/types'
import { useBestScore } from './hooks/useBestScore'
import { vibrate } from './utils/haptics'

function App() {
  const [state, setState] = useState(createInitialState)
  const [gameId, setGameId] = useState(0)
  const { bestScore, reportScore } = useBestScore()

  useEffect(() => {
    if (state.status === 'won') {
      vibrate('win')
      reportScore(state.placedCount)
    } else if (state.status === 'lost') {
      vibrate('lose')
      reportScore(state.placedCount)
    }
  }, [state.status, state.placedCount, reportScore])

  const handleRoll = () => {
    setState(prev => roll(prev))
  }

  const handleSelect = (index: number) => {
    setState(prev => {
      const next = place(prev, index)
      if (next !== prev) vibrate('place')
      return next
    })
  }

  const handleRestart = () => {
    setState(restart())
    setGameId(id => id + 1)
  }
  const handleNewGame = handleRestart

  return (
    <div className="app">
      <Header bestScore={bestScore} />
      <RollDisplay
        currentRoll={state.currentRoll}
        placedCount={state.placedCount}
        total={BOARD_SIZE}
        awaitingPlacement={state.status === 'rolled'}
      />
      <Board
        key={gameId}
        positions={state.positions}
        validPositions={state.validPositions}
        onSelect={handleSelect}
      />
      <Controls
        canRoll={state.status === 'idle'}
        onRoll={handleRoll}
        onRestart={handleRestart}
        onNewGame={handleNewGame}
      />

      {state.status === 'lost' && (
        <GameOverScreen
          reason={state.lossReason ?? 'No legal position remained for the rolled number.'}
          placedCount={state.placedCount}
          bestScore={bestScore}
          onNewGame={handleNewGame}
        />
      )}
      {state.status === 'won' && <WinScreen onNewGame={handleNewGame} />}
    </div>
  )
}

export default App
