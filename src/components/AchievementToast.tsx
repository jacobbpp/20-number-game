import type { Achievement } from '../game/achievements'

interface AchievementToastProps {
  achievement: Achievement
  onOpen: () => void
}

export function AchievementToast({ achievement, onOpen }: AchievementToastProps) {
  return (
    <div className="achievement-toast" role="status">
      <button type="button" className="achievement-toast__btn" onClick={onOpen}>
        <span className="achievement-toast__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
            <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
          </svg>
        </span>
        <span className="achievement-toast__text">
          <span className="achievement-toast__label">Achievement unlocked</span>
          <span className="achievement-toast__title">{achievement.title}</span>
        </span>
      </button>
    </div>
  )
}
