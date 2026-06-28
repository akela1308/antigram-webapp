import { useEffect, useState, useCallback, Children } from 'react'
import { CategoryFilmStrip } from '../components/CategoryFilmStrip'
import { MomentCard } from '../components/MomentCard'
import { MomentCardSkeleton } from '../components/Skeleton'
import { getRandomMoments, getMomentsByEmotion, getFeedReactions, getMomentStarTotals } from '../lib/db'
import type { MomentWithProfile, ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function ExplorePage() {
  const [filter, setFilter] = useState<FilterValue>('for_you')
  const [moments, setMoments] = useState<MomentWithProfile[]>([])
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [starTotals, setStarTotals] = useState<Record<string, number>>({})
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
      const [reactions, stars] = await Promise.all([
        getFeedReactions(ids),
        getMomentStarTotals(ids),
      ])
      const map: ReactionsMap = {}
      for (const r of reactions) {
        if (!map[r.moment_id]) map[r.moment_id] = []
        map[r.moment_id].push({ type: r.type })
      }
      setReactionsMap(map)
      setStarTotals(stars)
    } else {
      setReactionsMap({})
      setStarTotals({})
    }

    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
      <div
        style={{
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ padding: '12px 14px 10px' }}>
          <h1 style={{ color: 'var(--brown)', fontSize: 18, fontWeight: 800, letterSpacing: 0.3, margin: 0, fontFamily: 'Georgia, serif' }}>
            Подборки
          </h1>
        </div>
        <CategoryFilmStrip active={filter} onChange={setFilter} />
      </div>

      <div style={{ flex: 1, padding: '8px 12px 96px' }}>
        {loading ? (
          <PhotoGrid>
            {Array.from({ length: 8 }).map((_, i) => <MomentCardSkeleton key={i} />)}
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
                starTotal={starTotals[moment.id] ?? 0}
                onStarTotalChange={(momentId, total) => setStarTotals(prev => ({ ...prev, [momentId]: total }))}
              />
            ))}
          </PhotoGrid>
        )}
      </div>
    </div>
  )
}

function PhotoGrid({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children)
  const left = items.filter((_, i) => i % 2 === 0)
  const right = items.filter((_, i) => i % 2 === 1)
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {left}
      </div>
      <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {right}
      </div>
    </div>
  )
}
