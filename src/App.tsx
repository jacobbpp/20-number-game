import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import { GameOverScreen } from './components/GameOverScreen'
import { Header } from './components/Header'
import { RollDisplay } from './components/RollDisplay'
import { StatsScreen } from './components/StatsScreen'
import { WinScreen } from './components/WinScreen'
import { place, roll } from './game/engine'
import { extractPlacements } from './game/stats'
import { BOARD_SIZE, createInitialState, type ResultBadge } from './game/types'
import { useBestScore } from './hooks/useBestScore'
import { useGameStats } from './hooks/useGameStats'
import { vibrate } from './utils/haptics'

function startGame() {
  return roll(createInitialState())
}

function App() {
  const [state, setState] = useState(startGame)
  const [gameId, setGameId] = useState(0)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [resultBadge, setResultBadge] = useState<ResultBadge>(null)
  const { bestScore, reportScore } = useBestScore()
  const { stats, recordCompletedGame } = useGameStats()
  const prevPlacedRef = useRef(state.placedCount)

  useEffect(() => {
    if (state.status !== 'won' && state.status !== 'lost') return

    // bestScore is deliberately read from the closure here, not the dependency
    // array: it's the value from BEFORE reportScore updates it below, which is
    // exactly what "did this run beat the old best" needs. Adding bestScore to
    // the deps would re-fire this effect the moment reportScore changes it,
    // double-recording the same game into stats.
    setResultBadge(
      state.placedCount > bestScore ? 'new-best' : state.placedCount > 0 && state.placedCount === bestScore && bestScore > 0 ? 'tied-best' : null,
    )
    vibrate(state.status === 'won' ? 'win' : 'lose')
    reportScore(state.placedCount)
    recordCompletedGame(extractPlacements(state.positions), state.status)
  }, [state.status, state.placedCount, state.positions, reportScore, recordCompletedGame])

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
    setResultBadge(null)
  }

  return (
    <div className="app">
      {isStatsOpen ? (
        <StatsScreen stats={stats} onClose={() => setIsStatsOpen(false)} />
      ) : (
        <>
          <Header bestScore={bestScore} onRestart={handleRestart} onOpenStats={() => setIsStatsOpen(true)} />
          <RollDisplay currentRoll={state.currentRoll} placedCount={state.placedCount} total={BOARD_SIZE} />
          <Board
            key={gameId}
            positions={state.positions}
            validPositions={state.validPositions}
            onSelect={handleSelect}
          />
        </>
      )}

      {!isStatsOpen && state.status === 'lost' && (
        <GameOverScreen
          reason={state.lossReason ?? 'No legal position remained for the rolled number.'}
          placedCount={state.placedCount}
          resultBadge={resultBadge}
          onNewGame={handleRestart}
        />
      )}
      {!isStatsOpen && state.status === 'won' && <WinScreen onNewGame={handleRestart} />}
    </div>
  )
}

export default App
