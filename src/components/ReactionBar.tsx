import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

interface ReactionBarProps {
  reactions: { type: ReactionType }[]
  userReaction: ReactionType | null
  onReact: (type: ReactionType) => void
  size?: 'sm' | 'md'
  customMood?: { emoji: string; label: string } | null
}

export function ReactionBar({ reactions, userReaction, onReact, size = 'sm', customMood }: ReactionBarProps) {
  const counts = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {})

  const isSm = size === 'sm'
  const pad = isSm ? '3px 8px' : '5px 12px'
  const fs = isSm ? 12 : 14
  const efs = isSm ? 13 : 16

  function reactionBtn(
    key: string,
    type: ReactionType,
    emoji: string,
    label: string,
    isCustom = false,
  ) {
    const count = counts[type] ?? 0
    const isActive = userReaction === type
    return (
      <button
        key={key}
        onClick={() => onReact(type)}
        className="flex items-center gap-1 rounded-full transition-all"
        style={{
          padding: pad,
          fontSize: fs,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          background: isActive ? 'rgba(201,132,62,0.25)' : isCustom ? 'rgba(196,168,130,0.08)' : 'rgba(255,255,255,0.05)',
          border: isActive ? '1px solid var(--amber)' : isCustom ? '1px solid rgba(196,168,130,0.4)' : '1px solid var(--border)',
          color: isActive ? 'var(--amber)' : 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: efs }}>{emoji}</span>
        {!isSm && <span style={{ fontSize: 12, marginLeft: 2 }}>{label}</span>}
        {count > 0 && <span>{count}</span>}
      </button>
    )
  }

  return (
    <div
      className="no-scrollbar"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 1,
      }}
    >
      {EMOTIONS.map(e => reactionBtn(e.type, e.type, e.emoji, e.label))}
      {customMood && customMood.emoji && customMood.label &&
        reactionBtn('custom', 'custom', customMood.emoji, customMood.label, true)
      }
    </div>
  )
}
