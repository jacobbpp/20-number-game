import { useEffect, useRef, useState } from 'react'
import { AchievementsScreen } from './components/AchievementsScreen'
import { AchievementToast } from './components/AchievementToast'
import { BestRunScreen } from './components/BestRunScreen'
import { Board } from './components/Board'
import { DailyChallengeScreen } from './components/DailyChallengeScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { GuideScreen } from './components/GuideScreen'
import { Header } from './components/Header'
import { HomeScreen } from './components/HomeScreen'
import { HowToPlayScreen } from './components/HowToPlayScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { RollDisplay } from './components/RollDisplay'
import { SettingsScreen } from './components/SettingsScreen'
import { StatsScreen } from './components/StatsScreen'
import { WhatsNewScreen } from './components/WhatsNewScreen'
import { WinScreen } from './components/WinScreen'
import { CHANGELOG } from './changelog'
import { ACHIEVEMENTS } from './game/achievements'
import { createDailyRng, getDailyBoardSize, getLocalDateString } from './game/daily'
import { place, roll } from './game/engine'
import { extractPlacements, suggestedPosition } from './game/stats'
import { createInitialState, type ResultBadge } from './game/types'
import { useAchievements } from './hooks/useAchievements'
import { useBestScore } from './hooks/useBestScore'
import { useCurrentDailyGame } from './hooks/useCurrentDailyGame'
import { useCurrentGame } from './hooks/useCurrentGame'
import { useDailyChallenge } from './hooks/useDailyChallenge'
import { useCommunityStats } from './hooks/useCommunityStats'
import { useGameStats } from './hooks/useGameStats'
import { useHardMode } from './hooks/useHardMode'
import { useLeaderboard, type LeaderboardWindow } from './hooks/useLeaderboard'
import { useOnboarding } from './hooks/useOnboarding'
import { useShowHomeScreen } from './hooks/useShowHomeScreen'
import { useSoundSetting } from './hooks/useSoundSetting'
import { useTheme } from './hooks/useTheme'
import { useWhatsNew } from './hooks/useWhatsNew'
import { vibrate } from './utils/haptics'
import { playSound } from './utils/sound'
import { APP_VERSION } from './version'

function App() {
  const { state, setState, hasRecorded, setHasRecorded, restart } = useCurrentGame()
  const [gameId, setGameId] = useState(0)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isDailyOpen, setIsDailyOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isBestRunOpen, setIsBestRunOpen] = useState(false)
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [resultBadge, setResultBadge] = useState<ResultBadge>(null)
  const [leaderboardWindows, setLeaderboardWindows] = useState<LeaderboardWindow[] | null>(null)
  const { bestScore, bestRun, reportScore } = useBestScore()
  const { stats, recordCompletedGame } = useGameStats()
  const { matrix: communityMatrix, reportPlacements } = useCommunityStats()
  const { name: leaderboardName, dailyActivity, checkQualifies, submitScore, fetchLeaderboard, recordActivity } = useLeaderboard()
  const { hasSeenOnboarding, markSeen } = useOnboarding()
  const { muted, toggleMuted } = useSoundSetting()
  const { theme, toggleTheme } = useTheme()
  const { hardMode, toggleHardMode } = useHardMode()
  const { showHomeScreen, toggleShowHomeScreen } = useShowHomeScreen()
  const [isHomeOpen, setIsHomeOpen] = useState(showHomeScreen)
  const { isOpen: isWhatsNewOpen, unseenEntries, close: closeWhatsNew } = useWhatsNew(hasSeenOnboarding)

  // Frozen once per session — every daily-mode concept ("today's" rng,
  // board size, stored result, streak) derives from this single value
  // rather than each independently calling getLocalDateString(). Without
  // that, a session left open across a real midnight would have different
  // parts of the UI silently disagreeing about what day it is.
  const dailyDateRef = useRef(getLocalDateString())
  const dailyDate = dailyDateRef.current

  // Lets the leaderboard-qualification check (below) discard its result if
  // the player has already restarted by the time the network call resolves.
  const gameIdRef = useRef(gameId)
  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

  const { todayResult, streak, history, recordDailyResult } = useDailyChallenge(dailyDate)
  const { unlockedAt: unlockedAchievements, newlyUnlocked, dismissNewlyUnlocked } = useAchievements(stats, streak, bestScore)
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(!hasSeenOnboarding)
  const [showCoachMark, setShowCoachMark] = useState(false)
  const isFirstLaunchRef = useRef(!hasSeenOnboarding)
  const prevPlacedRef = useRef(state.placedCount)

  // Stable for the whole day: created once per date and reused for every
  // roll in today's attempt, so the sequence is identical for every player.
  const dailyRngRef = useRef(createDailyRng(dailyDate))
  const dailyBoardSize = getDailyBoardSize(dailyDate)
  const [dailyState, setDailyState] = useCurrentDailyGame(dailyDate, dailyBoardSize, () =>
    roll(createInitialState(dailyBoardSize), dailyRngRef.current),
  )
  const dailyPrevPlacedRef = useRef(dailyState.placedCount)

  // True whenever a full-screen modal (win/loss included) is covering the
  // board — the achievement toast waits for these to clear rather than
  // floating on top of a modal's dark scrim.
  const isOverlayActive =
    isHowToPlayOpen ||
    isWhatsNewOpen ||
    isChangelogOpen ||
    isBestRunOpen ||
    isAchievementsOpen ||
    state.status === 'lost' ||
    state.status === 'won'

  useEffect(() => {
    if (!showCoachMark) return
    const timeout = setTimeout(() => setShowCoachMark(false), 4000)
    return () => clearTimeout(timeout)
  }, [showCoachMark])

  useEffect(() => {
    if (newlyUnlocked.length === 0 || isOverlayActive) return
    const timeout = setTimeout(() => dismissNewlyUnlocked(), 4000)
    return () => clearTimeout(timeout)
  }, [newlyUnlocked, dismissNewlyUnlocked, isOverlayActive])

  useEffect(() => {
    if (state.status !== 'won' && state.status !== 'lost') return
    // hasRecorded guards against a refresh right after finishing: the
    // persisted game state restores as already won/lost, which would
    // otherwise re-fire this effect and double-record the same game into
    // stats and best score.
    if (hasRecorded) return

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
    reportScore(state.placedCount, state.positions)
    recordCompletedGame(
      extractPlacements(state.positions),
      state.status,
      state.status === 'lost' ? state.currentRoll : null,
      state.positions.length,
      hardMode,
    )
    reportPlacements(extractPlacements(state.positions))
    setHasRecorded(true)

    // Free play only (fixed board size 20) — daily board sizes vary, so a
    // "top 10" wouldn't mean the same thing from one day to the next.
    const requestedGameId = gameIdRef.current
    checkQualifies(state.positions.length, state.placedCount).then(windows => {
      if (gameIdRef.current !== requestedGameId) return
      // Recorded regardless of whether it qualified — Insights needs the
      // full count of today's games as the denominator, not just the hits.
      recordActivity(dailyDate, state.placedCount, windows)
      if (windows.length > 0) setLeaderboardWindows(windows)
    })
  }, [
    state.status,
    state.placedCount,
    state.positions,
    state.currentRoll,
    hasRecorded,
    hardMode,
    reportScore,
    recordCompletedGame,
    reportPlacements,
    setHasRecorded,
    checkQualifies,
    recordActivity,
    dailyDate,
  ])

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
      usedNumbers: dailyState.usedNumbers,
    })
  }, [
    dailyState.status,
    dailyState.positions,
    dailyState.placedCount,
    dailyState.lossReason,
    dailyState.usedNumbers,
    todayResult,
    recordDailyResult,
  ])

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
    restart()
    setGameId(id => id + 1)
    setResultBadge(null)
    setLeaderboardWindows(null)
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
    setIsHomeOpen(false)
    setIsDailyOpen(false)
    setIsSettingsOpen(false)
    setIsGuideOpen(false)
    setIsLeaderboardOpen(false)
    setIsStatsOpen(true)
  }

  const openDaily = () => {
    setIsHomeOpen(false)
    setIsStatsOpen(false)
    setIsSettingsOpen(false)
    setIsGuideOpen(false)
    setIsLeaderboardOpen(false)
    setIsDailyOpen(true)
  }

  const openSettings = () => {
    setIsHomeOpen(false)
    setIsStatsOpen(false)
    setIsDailyOpen(false)
    setIsGuideOpen(false)
    setIsLeaderboardOpen(false)
    setIsSettingsOpen(true)
  }

  const handlePlay = () => setIsHomeOpen(false)

  // Free play only — daily board sizes vary, so "position 5" doesn't mean
  // the same thing across days the way it does for the fixed-size matrix
  // this is built from.
  const freePlaySuggestion =
    state.currentRoll !== null ? suggestedPosition(communityMatrix, state.currentRoll, state.validPositions) : null

  return (
    <div className="app">
      {isHomeOpen ? (
        <HomeScreen
          bestScore={bestScore}
          winStreak={stats.currentWinStreak}
          todayResult={todayResult}
          dailyBoardSize={dailyBoardSize}
          onPlay={handlePlay}
          onPlayDaily={openDaily}
          onOpenStats={openStats}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onHideHomeScreen={() => {
            toggleShowHomeScreen()
            setIsHomeOpen(false)
          }}
        />
      ) : isDailyOpen ? (
        <DailyChallengeScreen
          dailyState={dailyState}
          todayResult={todayResult}
          streak={streak}
          history={history}
          today={dailyDate}
          hardMode={hardMode}
          onSelect={handleDailySelect}
          onClose={() => setIsDailyOpen(false)}
        />
      ) : isStatsOpen ? (
        <StatsScreen
          stats={stats}
          streak={streak}
          today={dailyDate}
          theme={theme}
          bestScore={bestScore}
          dailyActivity={dailyActivity}
          unlockedAchievementCount={Object.keys(unlockedAchievements).length}
          totalAchievementCount={ACHIEVEMENTS.length}
          onClose={() => setIsStatsOpen(false)}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          onOpenLeaderboard={() => {
            setIsStatsOpen(false)
            setIsLeaderboardOpen(true)
          }}
        />
      ) : isSettingsOpen ? (
        <SettingsScreen
          muted={muted}
          onToggleMuted={toggleMuted}
          theme={theme}
          onToggleTheme={toggleTheme}
          hardMode={hardMode}
          onToggleHardMode={toggleHardMode}
          showHomeScreen={showHomeScreen}
          onToggleShowHomeScreen={toggleShowHomeScreen}
          version={APP_VERSION}
          onOpenChangelog={() => setIsChangelogOpen(true)}
          onOpenGuide={() => {
            setIsSettingsOpen(false)
            setIsGuideOpen(true)
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : isGuideOpen ? (
        <GuideScreen
          onClose={() => {
            setIsGuideOpen(false)
            setIsSettingsOpen(true)
          }}
        />
      ) : isLeaderboardOpen ? (
        <LeaderboardScreen
          rememberedName={leaderboardName}
          fetchLeaderboard={fetchLeaderboard}
          onClose={() => {
            setIsLeaderboardOpen(false)
            setIsStatsOpen(true)
          }}
        />
      ) : (
        <>
          <Header
            bestScore={bestScore}
            onRestart={handleRestart}
            onOpenStats={openStats}
            showCoachMark={showCoachMark}
            todayResult={todayResult}
            dailyBoardSize={dailyBoardSize}
            onOpenDaily={openDaily}
            onOpenSettings={openSettings}
            onOpenBestRun={() => setIsBestRunOpen(true)}
          />
          <RollDisplay currentRoll={state.currentRoll} placedCount={state.placedCount} total={state.positions.length} />
          <Board
            key={gameId}
            positions={state.positions}
            validPositions={state.validPositions}
            hardMode={hardMode}
            suggestedPosition={freePlaySuggestion}
            onSelect={handleSelect}
          />
        </>
      )}

      {!isHomeOpen && !isStatsOpen && !isDailyOpen && !isSettingsOpen && !isGuideOpen && !isLeaderboardOpen && state.status === 'lost' && (
        <GameOverScreen
          reason={state.lossReason ?? 'No legal position remained for the rolled number.'}
          placedCount={state.placedCount}
          resultBadge={resultBadge}
          positions={state.positions}
          onNewGame={handleRestart}
          leaderboardWindows={leaderboardWindows}
          rememberedName={leaderboardName}
          onSaveScore={name => {
            submitScore(state.positions.length, name, state.placedCount)
            setLeaderboardWindows(null)
          }}
          onSkipScore={() => setLeaderboardWindows(null)}
        />
      )}
      {!isHomeOpen && !isStatsOpen && !isDailyOpen && !isSettingsOpen && !isGuideOpen && !isLeaderboardOpen && state.status === 'won' && (
        <WinScreen
          positions={state.positions}
          onNewGame={handleRestart}
          leaderboardWindows={leaderboardWindows}
          rememberedName={leaderboardName}
          onSaveScore={name => {
            submitScore(state.positions.length, name, state.placedCount)
            setLeaderboardWindows(null)
          }}
          onSkipScore={() => setLeaderboardWindows(null)}
        />
      )}
      {isHowToPlayOpen && <HowToPlayScreen onClose={handleCloseHowToPlay} />}
      {isWhatsNewOpen && <WhatsNewScreen entries={unseenEntries} onClose={closeWhatsNew} />}
      {isChangelogOpen && <WhatsNewScreen entries={CHANGELOG} onClose={() => setIsChangelogOpen(false)} />}
      {isBestRunOpen && <BestRunScreen bestScore={bestScore} bestRun={bestRun} onClose={() => setIsBestRunOpen(false)} />}
      {isAchievementsOpen && (
        <AchievementsScreen unlockedAt={unlockedAchievements} bestScore={bestScore} onClose={() => setIsAchievementsOpen(false)} />
      )}
      {newlyUnlocked[0] && !isOverlayActive && (
        <AchievementToast
          achievement={newlyUnlocked[0]}
          onOpen={() => {
            dismissNewlyUnlocked()
            setIsAchievementsOpen(true)
          }}
        />
      )}
    </div>
  )
}

export default App
