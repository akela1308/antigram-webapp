import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { StarSupportButton } from './StarSupportButton'
import type { MomentWithProfile } from '../lib/types'
import type { ReactionType } from '../lib/types'
import { EMOTIONS } from '../lib/types'

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
  const profile = moment.profiles
  const topReaction = getTopReaction(reactions)
  const isReacted = topReaction ? userReaction === topReaction.type : false

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
        {topReaction && (
          <div
            role={onReact ? 'button' : undefined}
            onClick={onReact ? (e) => { e.stopPropagation(); onReact(moment.id, topReaction.type) } : undefined}
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

function getTopReaction(reactions: { type: ReactionType }[]) {
  if (reactions.length === 0) return null
  const counts: Record<string, number> = {}
  for (const r of reactions) {
    counts[r.type] = (counts[r.type] ?? 0) + 1
  }
  const [topType, count] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]
  const emotion = EMOTIONS.find(e => e.type === topType)
  return emotion ? { emoji: emotion.emoji, label: emotion.label, type: emotion.type, count } : null
}
