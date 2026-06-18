import { useEffect, useState, useCallback } from 'react'
import { EmotionFilter } from '../components/EmotionFilter'
import { MomentCard } from '../components/MomentCard'
import { MomentCardSkeleton } from '../components/Skeleton'
import { getRandomMoments, getMomentsByEmotion, getFeedReactions } from '../lib/db'
import type { MomentWithProfile, ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function ExplorePage() {
  const [filter, setFilter] = useState<FilterValue>('for_you')
  const [moments, setMoments] = useState<MomentWithProfile[]>([])
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [loading, setLoading] = useState(true)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    let data: MomentWithProfile[] = []

    if (filter === 'for_you') {
      data = await getRandomMoments(60)
    } else {
      data = await getMomentsByEmotion(filter as ReactionType, 60)
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
  }, [filter])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 0px)' }}>
      <div
        className="sticky z-40"
        style={{
          top: 'var(--tg-top, 0px)',
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="px-4 pt-3 pb-0">
          <h1 className="text-lg font-bold" style={{ color: 'var(--amber)' }}>Подборки</h1>
        </div>
        <EmotionFilter active={filter} onChange={setFilter} />
      </div>

      <div style={{ flex: 1, padding: '8px 12px 96px' }}>
        {loading ? (
          <PhotoGrid>
            {Array.from({ length: 8 }).map((_, i) => (
              <MomentCardSkeleton key={i} />
            ))}
          </PhotoGrid>
        ) : moments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <span style={{ fontSize: 48 }}>🔍</span>
            <p style={{ color: 'var(--text-muted)' }}>Нет постов с такой эмоцией.</p>
          </div>
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

function PhotoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  )
}
