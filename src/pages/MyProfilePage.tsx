import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ProfileSkeleton, MomentCardSkeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserMoments,
  getFollowersCount,
  getFollowingCount,
} from '../lib/db'
import type { Moment } from '../lib/types'

export function MyProfilePage() {
  const { user, profile, loading: authLoading, signOut, isTelegram, telegramUser, loginWithTelegram, telegramAuthLoading } = useAuth()
  const navigate = useNavigate()

  const [moments, setMoments] = useState<Moment[]>([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const [m, fc, fgc] = await Promise.all([
      getUserMoments(user.id),
      getFollowersCount(user.id),
      getFollowingCount(user.id),
    ])
    setMoments(m)
    setFollowersCount(fc)
    setFollowingCount(fgc)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
        <div className="px-4 py-3 safe-top" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--amber)' }}>Мой профиль</h2>
        </div>
        <ProfileSkeleton />
        <div className="grid grid-cols-2 gap-2 px-3">
          {Array.from({ length: 4 }).map((_, i) => <MomentCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    const tgName = telegramUser
      ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ')
      : null
    const tgUsername = telegramUser?.username ? `@${telegramUser.username}` : null

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <span style={{ fontSize: 48 }}>👤</span>
        <p className="text-center" style={{ color: 'var(--text-muted)' }}>
          Войдите, чтобы увидеть свой профиль
        </p>
        {isTelegram && telegramUser ? (
          <button
            onClick={loginWithTelegram}
            disabled={telegramAuthLoading}
            className="px-8 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-opacity"
            style={{
              background: 'var(--amber)',
              color: '#140E0A',
              opacity: telegramAuthLoading ? 0.7 : 1,
            }}
          >
            {telegramAuthLoading ? (
              'Входим...'
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#140E0A">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                Войти как {tgName ?? tgUsername ?? 'Telegram'}
              </>
            )}
          </button>
        ) : (
          <Link
            to="/auth"
            className="px-8 py-3 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--amber)', color: '#140E0A' }}
          >
            Войти
          </Link>
        )}
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username ?? telegramUser?.first_name ?? 'Аноним'

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 safe-top"
        style={{ background: 'rgba(20,14,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <h2 className="text-base font-bold" style={{ color: 'var(--amber)' }}>Мой профиль</h2>
        <button
          onClick={handleSignOut}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}
        >
          Выйти
        </button>
      </div>

      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-4 px-6">
        {isTelegram && telegramUser?.photo_url ? (
          <img
            src={telegramUser.photo_url}
            alt={displayName}
            className="rounded-full object-cover"
            style={{ width: 80, height: 80 }}
          />
        ) : (
          <Avatar url={profile.avatar_url} name={displayName} size={80} />
        )}

        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{displayName}</h2>
          {profile.username && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>@{profile.username}</p>
          )}
          {isTelegram && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Telegram</span>
            </div>
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
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 16px 12px' }} />

      {/* Moments grid */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-28">
        {moments.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center py-16 gap-2">
            <span style={{ fontSize: 40 }}>📷</span>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Нет моментов
            </p>
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
