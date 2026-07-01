import { useState, useEffect, useCallback, Children } from 'react'
import { CategoryFilmStrip } from '../components/CategoryFilmStrip'
import { MomentCard } from '../components/MomentCard'
import { MomentCardSkeleton } from '../components/Skeleton'
import { searchUsers, getRandomMoments, getMomentsByEmotion, getFeedReactions, getMomentStarTotals } from '../lib/db'
import type { MomentWithProfile, ReactionType } from '../lib/types'
import type { Profile } from '../lib/types'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

type FilterValue = 'for_you' | ReactionType

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function SearchPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState<Profile[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [filter, setFilter] = useState<FilterValue>('for_you')
  const [moments, setMoments] = useState<MomentWithProfile[]>([])
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({})
  const [starTotals, setStarTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const isSearching = query.trim().length >= 2

  // Load discovery feed
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
    if (!isSearching) loadFeed()
  }, [filter, isSearching, loadFeed])

  // User search
  useEffect(() => {
    if (!isSearching) { setUserResults([]); return }
    let cancelled = false
    setSearchLoading(true)
    searchUsers(query.trim()).then(data => {
      if (!cancelled) { setUserResults(data); setSearchLoading(false) }
    })
    return () => { cancelled = true }
  }, [query, isSearching])

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* ── Sticky header ── */}
      <div
        style={{
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Title */}
        <div style={{ padding: '12px 14px 6px' }}>
          <h1 style={{ color: 'var(--brown)', fontSize: 18, fontWeight: 800, letterSpacing: 0.3, margin: 0, fontFamily: 'Georgia, serif' }}>
            {t('explore.title')}
          </h1>
        </div>

        {/* Search input */}
        <div style={{ padding: '0 14px 10px' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-warm)', borderRadius: 20,
              padding: '9px 14px', border: '1px solid var(--border)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('common.searchPeople')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Emotion filter strip (only when not searching) */}
        {!isSearching && (
          <CategoryFilmStrip active={filter} onChange={setFilter} />
        )}
      </div>

      {/* ── Content ── */}
      {isSearching ? (
        <div style={{ flex: 1 }}>
          {searchLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                style={{ borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {!searchLoading && userResults.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('common.notFound')}</p>
            </div>
          )}

          {userResults.map(profile => (
            <UserRow
              key={profile.id}
              profile={profile}
              onPress={() => navigate(`/profile/${profile.id}`)}
            />
          ))}
        </div>
      ) : (
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
                />
              ))}
            </PhotoGrid>
          )}
        </div>
      )}
    </div>
  )
}

function UserRow({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  const name = profile.display_name || profile.username || 'antigram'
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', background: 'none', border: 'none',
        borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={name}
          style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 44, height: 44, borderRadius: 22, flexShrink: 0,
            background: 'var(--bg-warm)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brown)', fontWeight: 700, fontSize: 16,
          }}
        >
          {name[0].toUpperCase()}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, margin: 0 }}>{name}</p>
        {profile.username && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>@{profile.username}</p>
        )}
        {profile.bio && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {profile.bio}
          </p>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
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
