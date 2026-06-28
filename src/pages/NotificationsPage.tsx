import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { EMOTIONS } from '../lib/types'
import type { NotificationItem, Profile, ReactionType } from '../lib/types'
import { getNotifications, markNotificationsRead } from '../lib/db'

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  if (hours < 48) return 'вчера'
  return `${Math.floor(hours / 24)} д назад`
}

function getProfileName(profile: Profile | null): string {
  return profile?.display_name || profile?.username || 'Кто-то'
}

function getProfileInitial(profile: Profile | null): string {
  return getProfileName(profile).trim().slice(0, 1).toUpperCase() || 'A'
}

function getPayloadText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function getNotificationText(notification: NotificationItem): string {
  const actor = getProfileName(notification.profiles)

  if (notification.type === 'follow') {
    return `${actor} подписался на вас`
  }

  if (notification.type === 'reaction') {
    const reactionType = getPayloadText(notification.payload, 'reaction_type') as ReactionType | null
    const emotion = EMOTIONS.find(e => e.type === reactionType)
    return emotion
      ? `${actor} отреагировал: ${emotion.emoji} ${emotion.label}`
      : `${actor} отреагировал на ваш момент`
  }

  const preview = getPayloadText(notification.payload, 'text_preview')
  return preview
    ? `${actor}: ${preview}`
    : `${actor} прокомментировал ваш момент`
}

function getNotificationTarget(notification: NotificationItem): string | null {
  if (notification.moment_id) return `/moment/${notification.moment_id}`
  if (notification.actor_id) return `/profile/${notification.actor_id}`
  return null
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      if (!user) {
        setItems([])
        setLoading(false)
        return
      }

      setLoading(true)
      const data = await getNotifications(user.id)
      if (!active) return

      setItems(data)
      setLoading(false)

      if (data.some(item => !item.read)) {
        const { error } = await markNotificationsRead(user.id)
        if (!active || error) return
        setItems(prev => prev.map(item => ({ ...item, read: true })))
        window.dispatchEvent(new Event('antigram:notifications-read'))
      }
    }

    load()
    return () => { active = false }
  }, [user])

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}
    >
      <div
        className="sticky z-40"
        style={{
          top: 'var(--tg-top, 56px)',
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
        }}
      >
        <h1
          style={{
            color: 'var(--brown)',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.3,
            margin: 0,
            fontFamily: 'Georgia, serif',
          }}
        >
          Уведомления
        </h1>
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ flex: 1, minHeight: 360, padding: '48px 24px', gap: 12 }}
        >
          <div
            className="rounded-full border-2 border-t-transparent animate-spin"
            style={{ width: 36, height: 36, borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : !user ? (
        <EmptyState
          text="Войдите, чтобы видеть уведомления"
          actionLabel="Войти"
          onAction={() => navigate('/auth')}
        />
      ) : items.length === 0 ? (
        <EmptyState text="Пока нет уведомлений" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 96 }}>
          {items.map(item => {
            const target = getNotificationTarget(item)
            return (
              <button
                key={item.id}
                onClick={() => { if (target) navigate(target) }}
                disabled={!target}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '44px minmax(0, 1fr) 48px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  background: item.read ? 'transparent' : 'rgba(196,132,62,0.08)',
                  border: 'none',
                  borderBottom: '1px solid #1A1208',
                  cursor: target ? 'pointer' : 'default',
                  textAlign: 'left',
                }}
              >
                <div style={{ position: 'relative', width: 44, height: 44 }}>
                  {item.profiles?.avatar_url ? (
                    <img
                      src={item.profiles.avatar_url}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        background: '#2E1A0A',
                        color: 'var(--amber)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      {getProfileInitial(item.profiles)}
                    </div>
                  )}
                  {!item.read && (
                    <span
                      style={{
                        position: 'absolute',
                        right: -1,
                        top: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: '#E55445',
                        border: '2px solid var(--bg)',
                      }}
                    />
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      color: 'var(--text)',
                      fontSize: 14,
                      fontWeight: item.read ? 500 : 700,
                      lineHeight: 1.35,
                      margin: 0,
                    }}
                  >
                    {getNotificationText(item)}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '4px 0 0' }}>
                    {formatTime(item.created_at)}
                  </p>
                </div>

                {item.moments?.photo_url ? (
                  <img
                    src={item.moments.photo_url}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  />
                )}
              </button>
            )
          })}
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
      style={{ flex: 1, minHeight: 360, padding: '48px 24px', gap: 12, textAlign: 'center' }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.5 }}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: 14,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
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
