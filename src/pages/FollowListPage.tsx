import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { getFollowers, getFollowing } from '../lib/db'
import type { FollowProfile } from '../lib/types'

type FollowListKind = 'followers' | 'following'

function formatName(item: FollowProfile): string {
  return item.profile.display_name || item.profile.username || 'Аноним'
}

function formatUsername(item: FollowProfile): string {
  return item.profile.username ? `@${item.profile.username}` : 'Профиль Antigram'
}

export function FollowListPage() {
  const { kind } = useParams<{ kind: FollowListKind }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<FollowProfile[]>([])
  const [loading, setLoading] = useState(true)

  const mode: FollowListKind = kind === 'following' ? 'following' : 'followers'
  const title = mode === 'followers' ? 'Подписчики' : 'Подписки'
  const emptyText = mode === 'followers'
    ? 'Пока никто не подписался'
    : 'Пока нет подписок'

  useEffect(() => {
    let active = true

    async function load() {
      if (authLoading) return
      if (!user) {
        setItems([])
        setLoading(false)
        return
      }

      setLoading(true)
      const data = mode === 'followers'
        ? await getFollowers(user.id)
        : await getFollowing(user.id)

      if (!active) return
      setItems(data)
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [authLoading, mode, user])

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)', background: 'var(--bg)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0 }}
        >
          <BackIcon />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: 'var(--brown)', fontSize: 18, fontWeight: 800, margin: 0, fontFamily: 'Georgia, serif' }}>
            {title}
          </h1>
          {user && (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '2px 0 0' }}>
              Видно только вам
            </p>
          )}
        </div>
      </div>

      {loading || authLoading ? (
        <div className="flex flex-col items-center justify-center" style={{ flex: 1, minHeight: 320, padding: 24 }}>
          <div
            className="rounded-full border-2 border-t-transparent animate-spin"
            style={{ width: 36, height: 36, borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : !user ? (
        <EmptyState
          text="Войдите, чтобы видеть свои подписки"
          actionLabel="Войти"
          onAction={() => navigate('/auth')}
        />
      ) : items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 104 }}>
          {items.map(item => (
            <button
              key={item.profile.id}
              onClick={() => navigate(`/profile/${item.profile.id}`)}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '48px minmax(0, 1fr) 18px',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #1A1208',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Avatar url={item.profile.avatar_url} name={formatName(item)} size={48} />
              <div style={{ minWidth: 0 }}>
                <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatName(item)}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatUsername(item)}
                </p>
              </div>
              <ChevronIcon />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ text, actionLabel, onAction }: {
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ flex: 1, minHeight: 320, padding: '48px 24px', gap: 12, textAlign: 'center' }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
        {text}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 4,
            padding: '10px 18px',
            borderRadius: 20,
            border: '1px solid var(--amber)',
            background: 'transparent',
            color: 'var(--amber)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
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

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
