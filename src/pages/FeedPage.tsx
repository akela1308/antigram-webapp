import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryFilmStrip } from '../components/CategoryFilmStrip'
import { StarSupportButton } from '../components/StarSupportButton'
import { MomentCardSkeleton } from '../components/Skeleton'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { formatRelativeTime, useLanguage } from '../contexts/LanguageContext'
import { getFeed, getRandomMoments, getMomentsByEmotion, getMomentStarTotals, getMomentReactionSummaries, buildReactionListMapFromSummaries, buildUserReactionMapFromSummaries, addReaction, removeReaction } from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { MomentWithProfile, ReactionType } from '../lib/types'
import { getMomentImageUrl } from '../lib/imageVariants'

type FilterValue = 'for_you' | ReactionType
type CustomMood = { emoji: string; label: string } | null

interface ReactionsMap {
  [momentId: string]: { type: ReactionType }[]
}

export function FeedPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
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
      if (user) {
        data = await getFeed(user.id, 40)
        if (data.length === 0) data = await getRandomMoments(40)
      } else {
        data = await getRandomMoments(40)
      }
    } else {
      data = await getMomentsByEmotion(filter as ReactionType, 40)
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

  const displayName = profile?.display_name ?? profile?.username ?? ''
  const avatarLetter = (displayName || 'A')[0].toUpperCase()

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* ── Header ── */}
      <div
        style={{
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Top bar: logo + search + avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px 10px',
          }}
        >
          {/* Logo */}
          <span
            style={{
              color: 'var(--brown)',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 0.3,
              flexShrink: 0,
              fontFamily: 'Georgia, serif',
            }}
          >
            Antigram
          </span>

          {/* Search bar */}
          <button
            onClick={() => navigate('/explore')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-warm)',
              borderRadius: 20,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <span style={{ color: 'var(--text-muted)', fontSize: 14, flex: 1, textAlign: 'left' }}>{t('common.search')}</span>
          </button>

          {/* Avatar */}
          <button
            onClick={() => navigate('/me')}
            style={{
              flexShrink: 0,
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '50%',
              outline: '1.5px solid var(--amber)',
              outlineOffset: 1,
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-warm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brown)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {avatarLetter}
              </div>
            )}
          </button>
        </div>

        {/* Category film strip */}
        <CategoryFilmStrip
          active={filter}
          onChange={setFilter}
          thumbnailScope={user ? 'following' : 'global'}
          userId={user?.id ?? null}
        />
      </div>

      {/* ── Feed ── */}
      <div style={{ flex: 1, padding: '0 0 96px' }}>
        {loading ? (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <MomentCardSkeleton key={i} />)}
          </div>
        ) : moments.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <>
            {/* ✦ Фото дня */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px 8px' }}>
              <span style={{ color: 'var(--amber)', fontSize: 12 }}>✦</span>
              <span
                style={{
                  color: 'var(--brown)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {t('feed.photoOfDay')}
              </span>
            </div>

            {/* Full-width first card */}
            <PhotoOfDayCard
              moment={moments[0]}
              reactions={reactionsMap[moments[0].id] ?? []}
              starTotal={starTotals[moments[0].id] ?? 0}
              onStarTotalChange={(momentId, total) => setStarTotals(prev => ({ ...prev, [momentId]: total }))}
              userReaction={userReactionsMap[moments[0].id] ?? null}
              onReact={handleReact}
            />

            {/* Film strip divider */}
            <FilmStripDivider />

            {/* Single-column large photos for the rest */}
            {moments.length > 1 && moments.slice(1).map(moment => (
              <div key={moment.id}>
                <FrameDivider />
                <PhotoOfDayCard
                  moment={moment}
                  reactions={reactionsMap[moment.id] ?? []}
                  starTotal={starTotals[moment.id] ?? 0}
                  onStarTotalChange={(momentId, total) => setStarTotals(prev => ({ ...prev, [momentId]: total }))}
                  userReaction={userReactionsMap[moment.id] ?? null}
                  onReact={handleReact}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function PhotoOfDayCard({
  moment,
  reactions,
  starTotal,
  onStarTotalChange,
  userReaction,
  onReact,
}: {
  moment: MomentWithProfile
  reactions: { type: ReactionType }[]
  starTotal: number
  onStarTotalChange: (momentId: string, total: number) => void
  userReaction?: ReactionType | null
  onReact?: (momentId: string, type: ReactionType) => void
}) {
  const { language, t } = useLanguage()
  const navigate = useNavigate()
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const profile = moment.profiles
  const displayName = profile?.display_name ?? profile?.username ?? t('common.anonymous')
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
      style={{ display: 'block', textDecoration: 'none', padding: '0 12px', cursor: 'pointer' }}
    >
      {/* Outer card — clips everything to rounded corners */}
      <div style={{ borderRadius: 16, overflow: 'hidden' }}>
        {/* Photo section — own relative context so overlays position against the photo */}
        <div style={{ position: 'relative' }}>
          <img
            src={getMomentImageUrl(moment, 'feed')}
            alt={moment.caption ?? ''}
            style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(20,14,10,0.85) 0%, transparent 45%)',
            }}
          />
          {/* Author + reaction overlay — anchored to bottom of photo */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar url={profile?.avatar_url} name={displayName} size={28} />
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>{displayName}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0 }}>
                  {formatRelativeTime(moment.created_at, language)}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {topReaction && (
                <div
                  role="button"
                  onClick={handleReactionClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: isReacted ? 'rgba(201,132,62,0.3)' : 'rgba(20,14,10,0.65)',
                    borderRadius: 20,
                    padding: '5px 10px',
                    border: `1px solid ${isReacted ? 'var(--amber)' : 'rgba(201,132,62,0.6)'}`,
                    cursor: onReact ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{topReaction.emoji}</span>
                  <span style={{ color: isReacted ? 'var(--amber)' : 'rgba(255,255,255,0.8)', fontSize: 11 }}>{topReaction.type === 'custom' ? topReaction.label : t(`emotion.${topReaction.type}`)}</span>
                  <span style={{ color: isReacted ? 'var(--amber)' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700 }}>{topReaction.count}</span>
                </div>
              )}
              <StarSupportButton
                momentId={moment.id}
                initialTotal={starTotal}
                variant="overlay"
                onTotalChange={(total) => onStarTotalChange(moment.id, total)}
              />
            </div>
          </div>
          {showReactionPicker && onReact && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                right: 14,
                bottom: 62,
                maxWidth: 'calc(100% - 28px)',
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                padding: '6px 8px',
                borderRadius: 22,
                background: 'rgba(20,14,10,0.88)',
                border: '1px solid rgba(201,132,62,0.35)',
                backdropFilter: 'blur(10px)',
                zIndex: 5,
              }}
            >
              {EMOTIONS.map(e => (
                <button
                  key={e.type}
                  onClick={() => handleReact(e.type)}
                  style={quickReactionStyle(userReaction === e.type)}
                  aria-label={t(`emotion.${e.type}`)}
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
                  <span style={{ fontSize: 10, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis' }}>{customMood.label}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Caption — below photo, inside same rounded card */}
        {moment.caption && (
          <div
            style={{
              background: '#110c08',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '10px 14px 12px',
            }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 13,
                margin: 0,
                lineHeight: 1.55,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {moment.caption}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Thin divider between feed cards (not the full film strip)
function FrameDivider() {
  return (
    <div style={{ margin: '16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ width: 8, height: 6, borderRadius: 1, border: '1px solid var(--film-amber-dark)', background: 'var(--film-hole)' }} />
        ))}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function FilmStripDivider() {
  return (
    <div style={{ margin: '14px 0', background: 'var(--film-track)', borderTop: '1px solid var(--film-amber-dark)', borderBottom: '1px solid var(--film-amber-dark)' }}>
      <div
        style={{
          height: 11,
          background: 'var(--film-amber)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{ width: 10, height: 8, borderRadius: 2, background: 'var(--film-hole)', flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  )
}


function EmptyState({ filter }: { filter: FilterValue }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <span style={{ fontSize: 48 }}>{filter === 'for_you' ? '🌅' : '🔍'}</span>
      <p style={{ color: 'var(--text-muted)' }}>
        {filter === 'for_you'
          ? t('feed.emptyFollowing')
          : t('feed.emptyEmotion')}
      </p>
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
