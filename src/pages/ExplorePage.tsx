import { useEffect, useState, useCallback, Children } from 'react'
import { CategoryFilmStrip } from '../components/CategoryFilmStrip'
import { MomentCard } from '../components/MomentCard'
import { MomentCardSkeleton } from '../components/Skeleton'
import { getRandomMoments, getMomentsByEmotion, getMomentStarTotals, getMomentReactionSummaries, buildReactionListMapFromSummaries, buildUserReactionMapFromSummaries, addReaction, removeReaction } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import type { MomentWithProfile, ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function ExplorePage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [filter, setFilter] = useState<FilterValue>('for_you')
  const [moments, setMoments] = useState<MomentWithProfile[]>([])
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [userReactionsMap, setUserReactionsMap] = useState<Record<string, ReactionType | null>>({})
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
      const [reactionSummaries, stars] = await Promise.all([
        getMomentReactionSummaries(ids, user?.id),
        getMomentStarTotals(ids),
      ])
      setReactionsMap(buildReactionListMapFromSummaries(reactionSummaries))
      setStarTotals(stars)
      setUserReactionsMap(buildUserReactionMapFromSummaries(reactionSummaries))
    } else {
      setReactionsMap({})
      setStarTotals({})
      setUserReactionsMap({})
    }

    setLoading(false)
  }, [filter, user])

  const handleReact = useCallback(async (momentId: string, type: ReactionType) => {
    if (!user) return
    const current = userReactionsMap[momentId] ?? null
    if (current === type) {
      setUserReactionsMap(prev => ({ ...prev, [momentId]: null }))
      setReactionsMap(prev => {
        const existing = prev[momentId] ?? []
        let removed = false
        return { ...prev, [momentId]: existing.filter(r => { if (!removed && r.type === type) { removed = true; return false } return true }) }
      })
      await removeReaction(momentId, user.id)
    } else {
      setUserReactionsMap(prev => ({ ...prev, [momentId]: type }))
      setReactionsMap(prev => {
        const existing = prev[momentId] ?? []
        let removedOld = false
        const filtered = current ? existing.filter(r => { if (!removedOld && r.type === current) { removedOld = true; return false } return true }) : existing
        return { ...prev, [momentId]: [...filtered, { type }] }
      })
      await addReaction(momentId, user.id, type)
    }
  }, [user, userReactionsMap])

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
            {t('explore.title')}
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
            <p style={{ color: 'var(--text-muted)' }}>{t('explore.emptyEmotion')}</p>
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
                userReaction={userReactionsMap[moment.id] ?? null}
                onReact={user ? handleReact : undefined}
                directTopReaction
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
