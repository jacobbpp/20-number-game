import { useEffect, useRef, useState } from 'react'
import { Board } from './components/Board'
import { DailyChallengeScreen } from './components/DailyChallengeScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { Header } from './components/Header'
import { HowToPlayScreen } from './components/HowToPlayScreen'
import { RollDisplay } from './components/RollDisplay'
import { StatsScreen } from './components/StatsScreen'
import { WinScreen } from './components/WinScreen'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
import { place, roll } from './game/engine'
import { extractPlacements } from './game/stats'
import { createInitialState, type ResultBadge } from './game/types'
import { useBestScore } from './hooks/useBestScore'
import { useDailyChallenge } from './hooks/useDailyChallenge'
import { useGameStats } from './hooks/useGameStats'
import { useOnboarding } from './hooks/useOnboarding'
import { useSoundSetting } from './hooks/useSoundSetting'
import { vibrate } from './utils/haptics'
import { playSound } from './utils/sound'

function startGame() {
  return roll(createInitialState())
}

function App() {
  const [state, setState] = useState(startGame)
  const [gameId, setGameId] = useState(0)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isDailyOpen, setIsDailyOpen] = useState(false)
  const [resultBadge, setResultBadge] = useState<ResultBadge>(null)
  const { bestScore, reportScore } = useBestScore()
  const { stats, recordCompletedGame } = useGameStats()
  const { hasSeenOnboarding, markSeen } = useOnboarding()
  const { muted, toggleMuted } = useSoundSetting()

  // Frozen once per session — every daily-mode concept ("today's" rng,
  // board size, stored result, streak) derives from this single value
  // rather than each independently calling getLocalDateString(). Without
  // that, a session left open across a real midnight would have different
  // parts of the UI silently disagreeing about what day it is.
  const dailyDateRef = useRef(getLocalDateString())
  const dailyDate = dailyDateRef.current

  const { todayResult, streak, history, recordDailyResult } = useDailyChallenge(dailyDate)
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(!hasSeenOnboarding)
  const [showCoachMark, setShowCoachMark] = useState(false)
  const isFirstLaunchRef = useRef(!hasSeenOnboarding)
  const prevPlacedRef = useRef(state.placedCount)

  // Stable for the whole day: created once per date and reused for every
  // roll in today's attempt, so the sequence is identical for every player.
  const dailyRngRef = useRef(createDailyRng(dailyDate))
  const dailyBoardSize = getDailyBoardSize(dailyDate)
  const [dailyState, setDailyState] = useState(() => roll(createInitialState(dailyBoardSize), dailyRngRef.current))
  const dailyPrevPlacedRef = useRef(dailyState.placedCount)

  useEffect(() => {
    if (!showCoachMark) return
    const timeout = setTimeout(() => setShowCoachMark(false), 4000)
    return () => clearTimeout(timeout)
  }, [showCoachMark])

  useEffect(() => {
    if (state.status !== 'won' && state.status !== 'lost') return

    // bestScore is deliberately excluded from this effect's dependency array
    // (oxlint's exhaustive-deps warning on the next line is expected and
    // safe to ignore): it's read from the closure below at the value from
    // BEFORE reportScore updates it, which is exactly what "did this run
    // beat the old best" needs. Adding bestScore to the deps would re-fire
    // this effect the moment reportScore changes it, double-recording the
    // same game into stats.
    const isNewBest = state.placedCount > bestScore
    const isTiedBest = !isNewBest && state.placedCount > 0 && state.placedCount === bestScore
    setResultBadge(isNewBest ? 'new-best' : isTiedBest ? 'tied-best' : null)

    vibrate(state.status === 'won' ? 'win' : 'lose')
    playSound(state.status === 'won' ? 'win' : 'lose')
    reportScore(state.placedCount)
    recordCompletedGame(extractPlacements(state.positions), state.status)
  }, [state.status, state.placedCount, state.positions, reportScore, recordCompletedGame])

  useEffect(() => {
    if (state.placedCount > prevPlacedRef.current) {
      vibrate('place')
      playSound('place')
    }
    prevPlacedRef.current = state.placedCount
  }, [state.placedCount])

  // todayResult is checked so a completed attempt never gets recorded twice
  // — dailyState itself never resets mid-session once it reaches won/lost,
  // so in practice this only fires once, but it's cheap insurance.
  //
  // Deliberately does NOT call recordCompletedGame: daily board sizes vary
  // (10-30), so "landed at position 5" doesn't mean the same thing across
  // different days — folding it into the fixed-20-position free-play
  // heatmap would make that data misleading rather than useful.
  useEffect(() => {
    if (dailyState.status !== 'won' && dailyState.status !== 'lost') return
    if (todayResult) return

    vibrate(dailyState.status === 'won' ? 'win' : 'lose')
    playSound(dailyState.status === 'won' ? 'win' : 'lose')
    recordDailyResult({
      positions: dailyState.positions,
      placedCount: dailyState.placedCount,
      status: dailyState.status,
      lossReason: dailyState.lossReason,
    })
  }, [dailyState.status, dailyState.positions, dailyState.placedCount, dailyState.lossReason, todayResult, recordDailyResult])

  useEffect(() => {
    if (dailyState.placedCount > dailyPrevPlacedRef.current) {
      vibrate('place')
      playSound('place')
    }
    dailyPrevPlacedRef.current = dailyState.placedCount
  }, [dailyState.placedCount])

  const handleSelect = (index: number) => {
    setState(prev => {
      const placed = place(prev, index)
      if (placed === prev || placed.status !== 'idle') return placed
      return roll(placed)
    })
  }

  const handleDailySelect = (index: number) => {
    setDailyState(prev => {
      const placed = place(prev, index)
      if (placed === prev || placed.status !== 'idle') return placed
      return roll(placed, dailyRngRef.current)
    })
  }

  const handleRestart = () => {
    setState(startGame())
    setGameId(id => id + 1)
    setResultBadge(null)
  }

  const handleCloseHowToPlay = () => {
    setIsHowToPlayOpen(false)
    markSeen()
    if (isFirstLaunchRef.current) {
      setShowCoachMark(true)
      isFirstLaunchRef.current = false
    }
  }

  const openStats = () => {
    setIsDailyOpen(false)
    setIsStatsOpen(true)
  }

  const openDaily = () => {
    setIsStatsOpen(false)
    setIsDailyOpen(true)
  }

  return (
    <div className="app">
      {isDailyOpen ? (
        <DailyChallengeScreen
          dailyState={dailyState}
          todayResult={todayResult}
          streak={streak}
          history={history}
          today={dailyDate}
          onSelect={handleDailySelect}
          onClose={() => setIsDailyOpen(false)}
        />
      ) : isStatsOpen ? (
        <StatsScreen
          stats={stats}
          onClose={() => setIsStatsOpen(false)}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        />
      ) : (
        <>
          <Header
            bestScore={bestScore}
            onRestart={handleRestart}
            onOpenStats={openStats}
            showCoachMark={showCoachMark}
            todayResult={todayResult}
            streak={streak}
            today={dailyDate}
            dailyBoardSize={dailyBoardSize}
            onOpenDaily={openDaily}
            muted={muted}
            onToggleMuted={toggleMuted}
          />
          <RollDisplay currentRoll={state.currentRoll} placedCount={state.placedCount} total={state.positions.length} />
          <Board
            key={gameId}
            positions={state.positions}
            validPositions={state.validPositions}
            onSelect={handleSelect}
          />
        </>
      )}

      {!isStatsOpen && !isDailyOpen && state.status === 'lost' && (
        <GameOverScreen
          reason={state.lossReason ?? 'No legal position remained for the rolled number.'}
          placedCount={state.placedCount}
          resultBadge={resultBadge}
          positions={state.positions}
          onNewGame={handleRestart}
        />
      )}
      {!isStatsOpen && !isDailyOpen && state.status === 'won' && (
        <WinScreen positions={state.positions} onNewGame={handleRestart} />
      )}
      {isHowToPlayOpen && <HowToPlayScreen onClose={handleCloseHowToPlay} />}
    </div>
  )
}

export default App
