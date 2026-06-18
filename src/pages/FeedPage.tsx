import React, { useEffect, useState, useCallback } from 'react'
import { EmotionFilter } from '../components/EmotionFilter'
import { MomentCard } from '../components/MomentCard'
import { MomentCardSkeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { getFeed, getRandomMoments, getMomentsByEmotion, getFeedReactions } from '../lib/db'
import type { MomentWithProfile, ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function FeedPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterValue>('for_you')
  const [moments, setMoments] = useState<MomentWithProfile[]>([])
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [loading, setLoading] = useState(true)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    let data: MomentWithProfile[] = []

    if (filter === 'for_you') {
      if (user) {
        data = await getFeed(user.id, 40)
        if (data.length === 0) {
          data = await getRandomMoments(40)
        }
      } else {
        data = await getRandomMoments(40)
      }
    } else {
      data = await getMomentsByEmotion(filter as ReactionType, 40)
    }

    setMoments(data)

    if (data.length > 0) {
      const ids = data.map(m => m.id)
      const reactions = await getFeedReactions(ids)
      const map: ReactionsMap = {}
      for (const r of reactions) {
        if (!map[r.moment_id]) map[r.moment_id] = []
        map[r.moment_id].push({ type: r.type })
      }
      setReactionsMap(map)
    }

    setLoading(false)
  }, [filter, user])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 0px)' }}>
      {/* Header — sticks below Telegram's own header */}
      <div
        className="sticky z-40"
        style={{
          top: 'var(--tg-top, 0px)',
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="px-4 pt-3 pb-0">
          <h1 className="text-lg font-bold" style={{ color: 'var(--amber)' }}>ANTIGRAM</h1>
        </div>
        <EmotionFilter active={filter} onChange={setFilter} />
      </div>

      {/* Feed grid */}
      <div style={{ flex: 1, padding: '8px 12px 96px' }}>
        {loading ? (
          <PhotoGrid>
            {Array.from({ length: 8 }).map((_, i) => (
              <MomentCardSkeleton key={i} />
            ))}
          </PhotoGrid>
        ) : moments.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <PhotoGrid>
            {moments.map(moment => (
              <MomentCard
                key={moment.id}
                moment={moment}
                reactions={reactionsMap[moment.id] ?? []}
              />
            ))}
          </PhotoGrid>
        )}
      </div>
    </div>
  )
}

// Two-column grid with explicit flex sizing (avoids CSS grid overflow bugs)
function PhotoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {React.Children.map(children, child => (
        <div style={{ width: 'calc(50% - 4px)', minWidth: 0 }}>
          {child}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filter }: { filter: FilterValue }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <span style={{ fontSize: 48 }}>
        {filter === 'for_you' ? '🌅' : '🔍'}
      </span>
      <p style={{ color: 'var(--text-muted)' }}>
        {filter === 'for_you'
          ? 'Пока нет моментов.\nПодпишитесь на людей, чтобы увидеть их.'
          : 'Нет постов с такой эмоцией.'}
      </p>
    </div>
  )
}
