import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ReactionBar } from '../components/ReactionBar'
import { StarSupportButton } from '../components/StarSupportButton'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
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
import { trackShareCardSent } from '../lib/analytics'
import { shareMomentToChat } from '../lib/telegramShare'
import { getMomentImageUrl } from '../lib/imageVariants'
import type { MomentWithProfile, ReactionType } from '../lib/types'

export function MomentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { language, t } = useLanguage()

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

  const handleShare = async () => {
    if (!moment) return
    await shareMomentToChat({
      momentId: moment.id,
      caption: moment.caption,
      photoUrl: getMomentImageUrl(moment, 'full'),
      language,
    })
    trackShareCardSent('telegram_chat')
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
        <p style={{ color: 'var(--text-muted)' }}>{t('moment.notFound')}</p>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--amber)' }}>← {t('common.back')}</button>
      </div>
    )
  }

  const profile = moment.profiles
  const displayName = profile?.display_name ?? profile?.username ?? t('common.anonymous')
  const dateStr = new Date(moment.created_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* Header */}
      <div
        className="flex items-center px-4 py-3"
        style={{ background: 'rgba(20,14,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', gap: 10 }}
      >
        <button onClick={() => navigate(-1)} className="p-1" style={{ flexShrink: 0 }}>
          <BackIcon />
        </button>
        {/* Author in header */}
        <Link
          to={`/profile/${profile?.id}`}
          className="flex items-center gap-2"
          style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
        >
          <Avatar url={profile?.avatar_url} name={displayName} size={30} />
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
            {profile?.username && (
              <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>@{profile.username}</span>
            )}
          </div>
        </Link>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => void handleShare()}
            className="p-1"
            aria-label={t('moment.share')}
            style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}
          >
            ↗
          </button>
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
          src={getMomentImageUrl(moment, 'full')}
          alt={moment.caption ?? ''}
          className="w-full"
          style={{ display: imgLoaded ? 'block' : 'block', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          onLoad={() => setImgLoaded(true)}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 pb-28">
        {/* Caption */}
        {moment.caption && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {moment.caption}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          {/* mood chip removed — mood shows as a reaction button in ReactionBar */}

          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              marginLeft: -2,
              padding: '1px 0 2px 2px',
            }}
          >
            <StarSupportButton
              momentId={moment.id}
              initialTotal={starTotal}
              variant="soft"
              onTotalChange={setStarTotal}
            />
            <ReactionBar
              reactions={reactions}
              userReaction={user ? userReaction : null}
              onReact={user ? handleReact : () => {}}
              size="sm"
              customMood={
                moment.custom_mood_emoji && moment.custom_mood_label
                  ? { emoji: moment.custom_mood_emoji, label: moment.custom_mood_label }
                  : null
              }
            />
          </div>
        </div>

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
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>{t('moment.deleteQuestion')}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>{t('moment.deleteHint')}</p>
            <button
              onClick={async () => {
                if (!id) return
                await deleteMoment(id)
                navigate(-1)
              }}
              style={{ width: '100%', padding: '14px 0', borderRadius: 30, background: '#e05a5a', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 10 }}
            >
              {t('common.delete')}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}
            >
              {t('common.cancel')}
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
