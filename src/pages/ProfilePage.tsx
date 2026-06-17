import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ProfileSkeleton, MomentCardSkeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import {
  getProfile,
  getUserMoments,
  isFollowing,
  followUser,
  unfollowUser,
  getFollowersCount,
  getFollowingCount,
} from '../lib/db'
import type { Profile, Moment } from '../lib/types'

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [following, setFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  const targetId = userId ?? ''
  const isOwnProfile = user?.id === targetId

  const load = useCallback(async () => {
    if (!targetId) return
    setLoading(true)
    const [p, m, fc, fgc] = await Promise.all([
      getProfile(targetId),
      getUserMoments(targetId),
      getFollowersCount(targetId),
      getFollowingCount(targetId),
    ])
    setProfile(p)
    setMoments(m)
    setFollowersCount(fc)
    setFollowingCount(fgc)

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
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="flex items-center gap-3 px-4 py-3 safe-top" style={{ borderBottom: '1px solid var(--border)' }}>
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
        <p style={{ color: 'var(--text-muted)' }}>Профиль не найден</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--amber)' }}>← Назад</button>
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username ?? 'Аноним'

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 safe-top"
        style={{ background: 'rgba(20,14,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => navigate(-1)} className="p-1"><BackIcon /></button>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          {profile.username ? `@${profile.username}` : displayName}
        </span>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-4 px-6">
        <Avatar url={profile.avatar_url} name={displayName} size={80} />

        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{displayName}</h2>
          {profile.username && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>@{profile.username}</p>
          )}
        </div>

        {profile.bio && (
          <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-8 mt-1">
          <Stat label="постов" value={moments.length} />
          <Stat label="подписчиков" value={followersCount} />
          <Stat label="подписок" value={followingCount} />
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
            {following ? 'Отписаться' : 'Подписаться'}
          </button>
        )}

        {isOwnProfile && (
          <Link
            to="/me"
            className="mt-2 px-8 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: 'rgba(201,132,62,0.1)', color: 'var(--amber)', border: '1px solid var(--border)' }}
          >
            Редактировать профиль
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
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет моментов</p>
          </div>
        ) : (
          moments.map(m => (
            <Link key={m.id} to={`/moment/${m.id}`}>
              <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '100%' }}>
                <img
                  src={m.photo_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
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
