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
}

export function MomentCard({ moment, reactions, starTotal = 0, onStarTotalChange }: MomentCardProps) {
  const navigate = useNavigate()
  const profile = moment.profiles
  const topReaction = getTopReaction(reactions)

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
            className="absolute bottom-2 left-2 text-xs flex items-center gap-0.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(20,14,10,0.75)', color: 'var(--text-muted)' }}
          >
            <span>{topReaction.emoji}</span>
            <span>{topReaction.count}</span>
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
  return emotion ? { emoji: emotion.emoji, count } : null
}
