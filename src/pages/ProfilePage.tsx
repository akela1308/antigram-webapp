import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { FilmStripHeader } from '../components/FilmStripHeader'
import { ProfileSkeleton, MomentCardSkeleton } from '../components/Skeleton'
import { StarCountPill } from '../components/StarSupportButton'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  getProfile,
  getUserMoments,
  isFollowing,
  followUser,
  unfollowUser,
  getBlockRelationship,
  blockUser,
  unblockUser,
  reportUser,
  getFollowersCount,
  getFollowingCount,
  getHighlights,
  getMomentStarTotals,
  getProfileStarTotal,
  getMomentReactionSummaries,
  buildReactionListMapFromSummaries,
} from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { Profile, Moment, HighlightWithMoment, ReactionType } from '../lib/types'
import { getMomentImageUrl } from '../lib/imageVariants'

type ReactionPreview = { type: ReactionType }

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [highlights, setHighlights] = useState<HighlightWithMoment[]>([])
  const [following, setFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [starTotal, setStarTotal] = useState(0)
  const [momentStarTotals, setMomentStarTotals] = useState<Record<string, number>>({})
  const [momentReactions, setMomentReactions] = useState<Record<string, ReactionPreview[]>>({})
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [blockRelationship, setBlockRelationship] = useState({ hasBlocked: false, blockedBy: false })
  const [blockLoading, setBlockLoading] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMessage, setReportMessage] = useState<string | null>(null)

  const targetId = userId ?? ''
  const isOwnProfile = user?.id === targetId

  const load = useCallback(async () => {
    if (!targetId) return
    setLoading(true)
    setBlockError(null)
    setReportMessage(null)

    const [p, fc, fgc, stars, relation] = await Promise.all([
      getProfile(targetId),
      getFollowersCount(targetId),
      getFollowingCount(targetId),
      getProfileStarTotal(targetId),
      user && !isOwnProfile
        ? getBlockRelationship(user.id, targetId)
        : Promise.resolve({ hasBlocked: false, blockedBy: false }),
    ])

    const contentHidden = relation.hasBlocked || relation.blockedBy
    const [m, hl] = contentHidden
      ? [[], []] as [Moment[], HighlightWithMoment[]]
      : await Promise.all([
        getUserMoments(targetId),
        getHighlights(targetId),
      ])

    setProfile(p)
    setMoments(m)
    setFollowersCount(fc)
    setFollowingCount(fgc)
    setHighlights(hl)
    setStarTotal(stars)
    setBlockRelationship(relation)
    setMomentStarTotals(m.length > 0 ? await getMomentStarTotals(m.map(moment => moment.id)) : {})
    if (m.length > 0) {
      const reactionSummaries = await getMomentReactionSummaries(m.map(moment => moment.id), user?.id)
      setMomentReactions(buildReactionListMapFromSummaries(reactionSummaries))
    } else {
      setMomentReactions({})
    }

    if (user && !isOwnProfile) {
      const f = contentHidden ? false : await isFollowing(user.id, targetId)
      setFollowing(f)
    } else {
      setFollowing(false)
    }
    setLoading(false)
  }, [targetId, user, isOwnProfile])

  useEffect(() => { load() }, [load])

  const handleFollow = async () => {
    if (!user || !targetId) return
    setFollowLoading(true)
    if (following) {
      await unfollowUser(user.id, targetId)
      setFollowing(false)
      setFollowersCount(c => c - 1)
    } else {
      await followUser(user.id, targetId)
      setFollowing(true)
      setFollowersCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  const handleBlockToggle = async () => {
    if (!user || !targetId || isOwnProfile) return

    setBlockLoading(true)
    setBlockError(null)

    if (blockRelationship.hasBlocked) {
      const { error } = await unblockUser(user.id, targetId)
      setBlockLoading(false)
      if (error) {
        console.error('[Blocks] unblock failed:', error)
        setBlockError(t('profile.unblockFailed'))
        return
      }
      setBlockRelationship(prev => ({ ...prev, hasBlocked: false }))
      await load()
      return
    }

    const { error } = await blockUser(user.id, targetId)
    if (error) {
      console.error('[Blocks] block failed:', error)
      setBlockLoading(false)
      setBlockError(t('profile.blockFailed'))
      return
    }

    if (following) {
      await unfollowUser(user.id, targetId)
      setFollowing(false)
      setFollowersCount(c => Math.max(0, c - 1))
    }

    setBlockRelationship(prev => ({ ...prev, hasBlocked: true }))
    setMoments([])
    setHighlights([])
    setMomentStarTotals({})
    setMomentReactions({})
    setBlockLoading(false)
  }

  const handleReportProfile = async () => {
    if (!user || !targetId || isOwnProfile) return

    setReportLoading(true)
    setReportMessage(null)
    const { error } = await reportUser(targetId, user.id)
    setReportLoading(false)

    if (error) {
      console.error('[Report] profile failed:', error)
      setReportMessage(t('profile.reportFailed'))
      return
    }

    setReportMessage(t('profile.reportSent'))
  }

  if (loading) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => navigate(-1)}><BackIcon /></button>
        </div>
        <ProfileSkeleton />
        <div className="grid grid-cols-2 gap-0.5 px-3">
          {Array.from({ length: 6 }).map((_, i) => <MomentCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p style={{ color: 'var(--text-muted)' }}>{t('profile.notFound')}</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--amber)' }}>← {t('common.back')}</button>
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username ?? t('common.anonymous')
  const profileRestricted = !isOwnProfile && (blockRelationship.hasBlocked || blockRelationship.blockedBy)

  const highlightSlotCount = Math.max(5, ...highlights.map(h => h.position + 1))
  const highlightItems = Array.from({ length: highlightSlotCount }, (_, i) => {
    const highlight = highlights.find(h => h.position === i)
    return highlight?.moments
      ? { momentId: highlight.moments.id, photoUrl: getMomentImageUrl(highlight.moments, 'thumb') }
      : null
  })
  const fallbackItems = moments.slice(0, 5).map(moment => ({
    momentId: moment.id,
    photoUrl: getMomentImageUrl(moment, 'thumb'),
  }))
  const hasHighlights = highlightItems.some(Boolean)
  const filmStripItems = hasHighlights
    ? highlightItems
    : Array.from({ length: 5 }, (_, i) => fallbackItems[i] ?? null)
  const ringPhotos: (string | null)[] = filmStripItems.map(item => item?.photoUrl ?? null)
  const hasFilmStrip = ringPhotos.some(Boolean)

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(20,14,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => navigate(-1)} className="p-1"><BackIcon /></button>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          {profile.username ? `@${profile.username}` : displayName}
        </span>
      </div>

      {/* Film strip highlights, falling back to latest public moments. */}
      {hasFilmStrip && (
        <FilmStripHeader
          photos={ringPhotos}
          isOwner={false}
          onOpenPhoto={i => {
            const momentId = filmStripItems[i]?.momentId
            if (momentId) navigate(`/moment/${momentId}`)
          }}
        />
      )}

      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-4 px-6">
        <Avatar url={profile.avatar_url} name={displayName} size={80} />

        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{displayName}</h2>
          {profile.username && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>@{profile.username}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <StarCountPill total={starTotal} />
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-8 mt-1">
          <Stat label={t('profile.posts')} value={moments.length} />
          <Stat label={t('profile.followers')} value={followersCount} />
          <Stat label={t('profile.following')} value={followingCount} />
        </div>

        {/* Follow / block controls */}
        {user && !isOwnProfile && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {!profileRestricted && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className="px-7 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: following ? 'transparent' : 'var(--amber)',
                  color: following ? 'var(--amber)' : '#140E0A',
                  border: following ? '1px solid var(--amber)' : 'none',
                  opacity: followLoading ? 0.6 : 1,
                }}
              >
                {following ? t('profile.unfollow') : t('profile.follow')}
              </button>
            )}
            <button
              onClick={handleBlockToggle}
              disabled={blockLoading}
              className="px-7 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: blockRelationship.hasBlocked ? 'rgba(201,132,62,0.1)' : 'transparent',
                color: blockRelationship.hasBlocked ? 'var(--amber)' : '#e05a5a',
                border: blockRelationship.hasBlocked ? '1px solid var(--border)' : '1px solid rgba(224,90,90,0.45)',
                opacity: blockLoading ? 0.6 : 1,
              }}
            >
              {blockRelationship.hasBlocked ? t('profile.unblock') : t('profile.block')}
            </button>
            <button
              onClick={handleReportProfile}
              disabled={reportLoading}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                opacity: reportLoading ? 0.6 : 1,
              }}
            >
              {t('profile.report')}
            </button>
          </div>
        )}

        {blockError && (
          <p className="text-xs text-center" style={{ color: '#e05a5a', margin: 0 }}>{blockError}</p>
        )}

        {reportMessage && (
          <p
            className="text-xs text-center"
            style={{ color: reportMessage === t('profile.reportSent') ? 'var(--amber)' : '#e05a5a', margin: 0 }}
          >
            {reportMessage}
          </p>
        )}

        {profileRestricted && (
          <p
            className="text-sm text-center leading-relaxed"
            style={{ color: 'var(--text-muted)', maxWidth: 280, margin: 0 }}
          >
            {blockRelationship.hasBlocked ? t('profile.blocked') : t('profile.blockedBy')}
          </p>
        )}

        {isOwnProfile && (
          <Link
            to="/me"
            className="mt-2 px-8 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'rgba(201,132,62,0.1)', color: 'var(--amber)', border: '1px solid var(--border)' }}
          >
            {t('profile.edit')}
          </Link>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 16px 12px' }} />

      {/* Moments grid */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-28">
        {profileRestricted ? (
          <div className="col-span-2 flex flex-col items-center py-16 gap-2">
            <span style={{ fontSize: 34 }}>×</span>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              {blockRelationship.hasBlocked ? t('profile.blocked') : t('profile.blockedBy')}
            </p>
          </div>
        ) : moments.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center py-16 gap-2">
            <span style={{ fontSize: 40 }}>📷</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('profile.noMoments')}</p>
          </div>
        ) : (
          moments.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => navigate('/moment-feed', { state: { moments, startIndex: idx, isOwner: isOwnProfile, userId: targetId } })}
              style={{ cursor: 'pointer' }}
            >
              <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '100%' }}>
                <img
                  src={getMomentImageUrl(m, 'thumb')}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <ReactionPreviewPill
                  moment={m}
                  reactions={momentReactions[m.id] ?? []}
                />
                <StarCountPill
                  total={momentStarTotals[m.id] ?? 0}
                  compact
                  style={{ position: 'absolute', right: 7, bottom: 7 }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ReactionPreviewPill({ moment, reactions }: { moment: Moment; reactions: ReactionPreview[] }) {
  const { t } = useLanguage()
  const topReaction = getTopReaction(moment, reactions, t)
  if (!topReaction) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: 7,
        bottom: 7,
        maxWidth: 'calc(100% - 64px)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 999,
        background: 'rgba(20,14,10,0.72)',
        border: '1px solid rgba(201,132,62,0.42)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ fontSize: 12 }}>{topReaction.emoji}</span>
      <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {topReaction.label}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 10, fontWeight: 800 }}>{topReaction.count}</span>
    </div>
  )
}

function getTopReaction(moment: Moment, reactions: ReactionPreview[], t: (key: string) => string) {
  if (reactions.length === 0) return null

  const counts: Record<string, number> = {}
  for (const reaction of reactions) {
    counts[reaction.type] = (counts[reaction.type] ?? 0) + 1
  }

  const [topType, count] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]
  if (topType === 'custom') {
    if (!moment.custom_mood_emoji || !moment.custom_mood_label) return null
    return {
      emoji: moment.custom_mood_emoji,
      label: moment.custom_mood_label,
      count,
    }
  }

  const emotion = EMOTIONS.find(e => e.type === topType)
  return emotion ? { emoji: emotion.emoji, label: t(`emotion.${emotion.type}`), count } : null
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
