import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ReactionBar } from '../components/ReactionBar'
import { StarSupportButton } from '../components/StarSupportButton'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import {
  getMoment,
  getReactions,
  getMomentStarTotal,
  addReaction,
  removeReaction,
  isMomentSaved,
  saveMoment,
  unsaveMoment,
  deleteMoment,
} from '../lib/db'
import type { MomentWithProfile, ReactionType } from '../lib/types'

export function MomentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [moment, setMoment] = useState<MomentWithProfile | null>(null)
  const [reactions, setReactions] = useState<{ moment_id: string; user_id: string; type: ReactionType }[]>([])
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null)
  const [starTotal, setStarTotal] = useState(0)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [m, r, stars] = await Promise.all([getMoment(id), getReactions(id), getMomentStarTotal(id)])
    setMoment(m)
    setReactions(r)
    setStarTotal(stars)

    if (user) {
      const myReaction = r.find(rx => rx.user_id === user.id)
      setUserReaction(myReaction?.type ?? null)
      const s = await isMomentSaved(user.id, id)
      setSaved(s)
    }
    setLoading(false)
  }, [id, user])

  useEffect(() => { load() }, [load])

  const handleReact = async (type: ReactionType) => {
    if (!user || !id) return

    if (userReaction === type) {
      await removeReaction(id, user.id)
      setReactions(prev => prev.filter(r => r.user_id !== user.id))
      setUserReaction(null)
    } else {
      await addReaction(id, user.id, type)
      setReactions(prev => [
        ...prev.filter(r => r.user_id !== user.id),
        { moment_id: id, user_id: user.id, type },
      ])
      setUserReaction(type)
    }
  }

  const handleSave = async () => {
    if (!user || !id) return
    if (saved) {
      await unsaveMoment(user.id, id)
      setSaved(false)
    } else {
      await saveMoment(user.id, id)
      setSaved(true)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => navigate(-1)}>
            <BackIcon />
          </button>
        </div>
        <Skeleton className="w-full" style={{ paddingBottom: '100%' }} />
        <div className="p-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
      </div>
    )
  }

  if (!moment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p style={{ color: 'var(--text-muted)' }}>Момент не найден</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--amber)' }}>← Назад</button>
      </div>
    )
  }

  const profile = moment.profiles
  const displayName = profile?.display_name ?? profile?.username ?? 'Аноним'
  const dateStr = new Date(moment.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(20,14,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
      >
        <button onClick={() => navigate(-1)} className="p-1">
          <BackIcon />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {user && moment && user.id === moment.user_id && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}
            >
              ⋯
            </button>
          )}
          {user && (
            <button onClick={handleSave} className="p-1">
              <BookmarkIcon filled={saved} />
            </button>
          )}
        </div>
      </div>

      {/* Photo */}
      <div className="relative w-full bg-black" style={{ background: '#0a0705' }}>
        {!imgLoaded && (
          <div className="absolute inset-0 skeleton" style={{ paddingBottom: '100%' }} />
        )}
        <img
          src={moment.photo_url}
          alt={moment.caption ?? ''}
          className="w-full"
          style={{ display: imgLoaded ? 'block' : 'block', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          onLoad={() => setImgLoaded(true)}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-4 pb-28">
        {/* Author */}
        <Link
          to={`/profile/${profile?.id}`}
          className="flex items-center gap-3"
        >
          <Avatar url={profile?.avatar_url} name={displayName} size={40} />
          <div className="flex flex-col">
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{displayName}</span>
            {profile?.username && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>@{profile.username}</span>
            )}
          </div>
        </Link>

        {/* Caption */}
        {moment.caption && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {moment.caption}
          </p>
        )}

        {/* Mood */}
        {moment.mood && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm self-start"
            style={{ background: 'rgba(201,132,62,0.1)', border: '1px solid var(--border)', color: 'var(--amber)' }}
          >
            {moment.custom_mood_emoji && <span>{moment.custom_mood_emoji}</span>}
            <span>{moment.custom_mood_label ?? moment.mood}</span>
          </div>
        )}

        {/* Stars */}
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Поддержать Stars</p>
          <StarSupportButton
            momentId={moment.id}
            initialTotal={starTotal}
            variant="inline"
            label="рейтинг кадра"
            onTotalChange={setStarTotal}
          />
        </div>

        {/* Reactions */}
        {user ? (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Откликнуться</p>
            <ReactionBar
              reactions={reactions}
              userReaction={userReaction}
              onReact={handleReact}
              size="md"
              customMood={
                moment.custom_mood_emoji && moment.custom_mood_label
                  ? { emoji: moment.custom_mood_emoji, label: moment.custom_mood_label }
                  : null
              }
            />
          </div>
        ) : (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Реакции</p>
            <ReactionBar
              reactions={reactions}
              userReaction={null}
              onReact={() => {}}
              size="md"
              customMood={
                moment.custom_mood_emoji && moment.custom_mood_label
                  ? { emoji: moment.custom_mood_emoji, label: moment.custom_mood_label }
                  : null
              }
            />
          </div>
        )}

        {/* Date */}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dateStr}</p>
      </div>

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <>
          <div
            onClick={() => setShowDeleteConfirm(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08', borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218',
            padding: '24px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Удалить кадр?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>Это действие нельзя отменить</p>
            <button
              onClick={async () => {
                if (!id) return
                await deleteMoment(id)
                navigate(-1)
              }}
              style={{ width: '100%', padding: '14px 0', borderRadius: 30, background: '#e05a5a', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 10 }}
            >
              Удалить
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}
            >
              Отмена
            </button>
          </div>
        </>
      )}
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

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'var(--amber)' : 'none'} stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}
