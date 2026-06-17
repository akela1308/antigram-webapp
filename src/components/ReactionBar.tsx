import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

interface ReactionBarProps {
  reactions: { type: ReactionType }[]
  userReaction: ReactionType | null
  onReact: (type: ReactionType) => void
  size?: 'sm' | 'md'
}

export function ReactionBar({ reactions, userReaction, onReact, size = 'sm' }: ReactionBarProps) {
  const counts = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOTIONS.map(e => {
        const count = counts[e.type] ?? 0
        const isActive = userReaction === e.type
        const isSm = size === 'sm'

        return (
          <button
            key={e.type}
            onClick={() => onReact(e.type)}
            className="flex items-center gap-1 rounded-full transition-all"
            style={{
              padding: isSm ? '3px 8px' : '5px 12px',
              fontSize: isSm ? 12 : 14,
              background: isActive ? 'rgba(201,132,62,0.25)' : 'rgba(255,255,255,0.05)',
              border: isActive ? '1px solid var(--amber)' : '1px solid var(--border)',
              color: isActive ? 'var(--amber)' : 'var(--text-muted)',
            }}
          >
            <span style={{ fontSize: isSm ? 13 : 16 }}>{e.emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
