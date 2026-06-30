import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { StarSupportButton } from './StarSupportButton'
import type { MomentWithProfile } from '../lib/types'
import type { ReactionType } from '../lib/types'
import { EMOTIONS } from '../lib/types'

type CustomMood = { emoji: string; label: string } | null

interface MomentCardProps {
  moment: MomentWithProfile
  reactions: { type: ReactionType }[]
  starTotal?: number
  onStarTotalChange?: (momentId: string, total: number) => void
  userReaction?: ReactionType | null
  onReact?: (momentId: string, type: ReactionType) => void
}

export function MomentCard({ moment, reactions, starTotal = 0, onStarTotalChange, userReaction, onReact }: MomentCardProps) {
  const navigate = useNavigate()
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const profile = moment.profiles
  const customMood = getCustomMood(moment)
  const topReaction = getTopReaction(reactions, customMood)
  const isReacted = topReaction ? userReaction === topReaction.type : false

  function handleReactionClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!onReact) return
    setShowReactionPicker(open => !open)
  }

  function handleReact(type: ReactionType) {
    onReact?.(moment.id, type)
    setShowReactionPicker(false)
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/moment/${moment.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          navigate(`/moment/${moment.id}`)
        }
      }}
      className="flex flex-col gap-1.5 group"
      style={{ cursor: 'pointer' }}
    >
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ paddingBottom: '125%' }}
      >
        <img
          src={moment.photo_url}
          alt={moment.caption ?? ''}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-active:scale-95"
          loading="lazy"
        />
        {showReactionPicker && onReact && (
          <div
            onClick={e => e.stopPropagation()}
            className="absolute left-2 bottom-12 flex items-center gap-1.5 px-2 py-1.5 rounded-full"
            style={{
              maxWidth: 'calc(100% - 16px)',
              overflowX: 'auto',
              background: 'rgba(20,14,10,0.88)',
              border: '1px solid rgba(201,132,62,0.35)',
              backdropFilter: 'blur(10px)',
              zIndex: 4,
            }}
          >
            {EMOTIONS.map(e => (
              <button
                key={e.type}
                onClick={() => handleReact(e.type)}
                style={quickReactionStyle(userReaction === e.type)}
                aria-label={e.label}
              >
                {e.emoji}
              </button>
            ))}
            {customMood && (
              <button
                onClick={() => handleReact('custom')}
                style={{
                  ...quickReactionStyle(userReaction === 'custom'),
                  width: 'auto',
                  padding: '0 8px',
                  gap: 4,
                }}
                aria-label={customMood.label}
              >
                <span>{customMood.emoji}</span>
                <span style={{ fontSize: 10, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis' }}>{customMood.label}</span>
              </button>
            )}
          </div>
        )}
        {topReaction && (
          <div
            role={onReact ? 'button' : undefined}
            onClick={handleReactionClick}
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: isReacted ? 'rgba(201,132,62,0.3)' : 'rgba(20,14,10,0.78)',
              border: `1px solid ${isReacted ? 'var(--amber)' : 'rgba(255,255,255,0.12)'}`,
              cursor: onReact ? 'pointer' : 'default',
            }}
          >
            <span style={{ fontSize: 12 }}>{topReaction.emoji}</span>
            <span style={{ fontSize: 10, color: isReacted ? 'var(--amber)' : 'var(--text-muted)', fontWeight: 600 }}>{topReaction.label}</span>
            <span style={{ fontSize: 10, color: isReacted ? 'var(--amber)' : 'var(--text-muted)' }}>{topReaction.count}</span>
          </div>
        )}
        <div style={{ position: 'absolute', right: 8, bottom: 8 }}>
          <StarSupportButton
            momentId={moment.id}
            initialTotal={starTotal}
            variant="overlay"
            onTotalChange={(total) => onStarTotalChange?.(moment.id, total)}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-0.5">
        <Avatar url={profile?.avatar_url} name={profile?.display_name ?? profile?.username} size={20} />
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {profile?.display_name ?? profile?.username ?? 'Аноним'}
        </span>
      </div>
    </div>
  )
}

function getCustomMood(moment: MomentWithProfile): CustomMood {
  if (!moment.custom_mood_emoji || !moment.custom_mood_label) return null
  return { emoji: moment.custom_mood_emoji, label: moment.custom_mood_label }
}

function getTopReaction(reactions: { type: ReactionType }[], customMood: CustomMood) {
  if (reactions.length === 0) return null
  const counts: Record<string, number> = {}
  for (const r of reactions) {
    counts[r.type] = (counts[r.type] ?? 0) + 1
  }
  const [topType, count] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]
  const emotion = EMOTIONS.find(e => e.type === topType)
  if (topType === 'custom' && customMood) {
    return { emoji: customMood.emoji, label: customMood.label, type: 'custom' as ReactionType, count }
  }
  return emotion ? { emoji: emotion.emoji, label: emotion.label, type: emotion.type, count } : null
}

function quickReactionStyle(active: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 15,
    border: active ? '1px solid var(--amber)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(201,132,62,0.26)' : 'rgba(255,255,255,0.06)',
    color: active ? 'var(--amber)' : 'rgba(255,255,255,0.86)',
    fontSize: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
  }
}
