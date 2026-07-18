import { ACHIEVEMENTS, NAMED_ACHIEVEMENTS, SCORE_MILESTONES } from '../game/achievements'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface AchievementsScreenProps {
  unlockedAt: Record<string, number>
  bestScore: number
  onClose: () => void
}

export function AchievementsScreen({ unlockedAt, bestScore, onClose }: AchievementsScreenProps) {
  const containerRef = useFocusTrap<HTMLDivElement>()
  const unlockedCount = ACHIEVEMENTS.filter(achievement => achievement.id in unlockedAt).length

  return (
    <div className="overlay" role="alertdialog" aria-labelledby="achievements-title" ref={containerRef}>
      <div className="overlay__card achievements">
        <h2 id="achievements-title" className="overlay__title achievements__title">
          Achievements
        </h2>
        <p className="achievements__count">
          {unlockedCount} of {ACHIEVEMENTS.length} unlocked
        </p>

        <div className="achievements__scroll">
          <div className="milestones">
            <p className="milestones__title">Milestones</p>
            <p className="milestones__caption">
              {bestScore} of {SCORE_MILESTONES.length} — your best run placed {bestScore} number{bestScore === 1 ? '' : 's'}
            </p>
            <div className="milestones__grid" role="group" aria-label="Score milestones, 1 to 20">
              {SCORE_MILESTONES.map((milestone, index) => {
                const n = index + 1
                const unlocked = milestone.id in unlockedAt
                return (
                  <span
                    key={milestone.id}
                    className={`milestone-badge${unlocked ? ' milestone-badge--unlocked' : ''}`}
                    aria-label={`${n} of ${SCORE_MILESTONES.length}${unlocked ? ', reached' : ', not reached yet'}`}
                  >
                    {n}
                  </span>
                )
              })}
            </div>
          </div>

          {NAMED_ACHIEVEMENTS.map(achievement => {
            const unlocked = achievement.id in unlockedAt
            return (
              <div key={achievement.id} className={`achievement-row${unlocked ? ' achievement-row--unlocked' : ''}`}>
                <span className="achievement-row__icon" aria-hidden="true">
                  {unlocked ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 21h8" />
                      <path d="M12 17v4" />
                      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                      <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
                      <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                </span>
                <div className="achievement-row__text">
                  <p className="achievement-row__title">
                    <span className="sr-only">{unlocked ? 'Unlocked. ' : 'Locked. '}</span>
                    {achievement.title}
                  </p>
                  <p className="achievement-row__desc">{achievement.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  )
}
