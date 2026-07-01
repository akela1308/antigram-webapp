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
  getFollowersCount,
  getFollowingCount,
  getHighlights,
  getMomentStarTotals,
  getProfileStarTotal,
  getFeedReactions,
} from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { Profile, Moment, HighlightWithMoment, ReactionType } from '../lib/types'

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

  const targetId = userId ?? ''
  const isOwnProfile = user?.id === targetId

  const load = useCallback(async () => {
    if (!targetId) return
    setLoading(true)
    const [p, m, fc, fgc, hl, stars] = await Promise.all([
      getProfile(targetId),
      getUserMoments(targetId),
      getFollowersCount(targetId),
      getFollowingCount(targetId),
      getHighlights(targetId),
      getProfileStarTotal(targetId),
    ])
    setProfile(p)
    setMoments(m)
    setFollowersCount(fc)
    setFollowingCount(fgc)
    setHighlights(hl)
    setStarTotal(stars)
    setMomentStarTotals(m.length > 0 ? await getMomentStarTotals(m.map(moment => moment.id)) : {})
    if (m.length > 0) {
      const reactions = await getFeedReactions(m.map(moment => moment.id))
      const reactionMap: Record<string, ReactionPreview[]> = {}
      for (const reaction of reactions) {
        if (!reactionMap[reaction.moment_id]) reactionMap[reaction.moment_id] = []
        reactionMap[reaction.moment_id].push({ type: reaction.type })
      }
      setMomentReactions(reactionMap)
    } else {
      setMomentReactions({})
    }

    if (user && !isOwnProfile) {
      const f = await isFollowing(user.id, targetId)
      setFollowing(f)
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

  const ringPhotos: (string | null)[] = Array.from({ length: 5 }, (_, i) => {
    const hl = highlights.find(h => h.position === i)
    return hl?.moments?.photo_url ?? null
  })
  const hasHighlights = highlights.length > 0

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

      {/* Film strip highlights — сразу под шапкой, если есть */}
      {hasHighlights && (
        <FilmStripHeader
          photos={ringPhotos}
          isOwner={false}
          onOpenPhoto={i => {
            const hl = highlights.find(h => h.position === i)
            if (hl?.moments?.id) navigate(`/moment/${hl.moments.id}`)
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

        {/* Follow button */}
        {user && !isOwnProfile && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className="mt-2 px-8 py-2.5 rounded-xl font-semibold text-sm transition-all"
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
        {moments.length === 0 ? (
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
                  src={m.photo_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
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
  const topReaction = getTopReaction(moment, reactions)
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

function getTopReaction(moment: Moment, reactions: ReactionPreview[]) {
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
  return emotion ? { emoji: emotion.emoji, label: emotion.label, count } : null
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
