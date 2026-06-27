import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getFeedReactions,
  getUserReactionsForMoments,
  addReaction,
  removeReaction,
  deleteMoment,
  getUserAlbums,
  addMomentToAlbum,
} from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { Moment, ReactionType, AlbumWithMoments } from '../lib/types'
import { trackReactionAdded, trackMomentSaved } from '../lib/analytics'

type ReactionCounts = Partial<Record<ReactionType, number>>

interface FeedState {
  moments?: Moment[]
  startIndex?: number
  isOwner?: boolean
  userId?: string
}

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

async function savePhoto(photoUrl: string): Promise<void> {
  // Telegram Bot API 8.0+ native download
  const tg = (window as any).Telegram?.WebApp
  if (typeof tg?.downloadFile === 'function') {
    tg.downloadFile(photoUrl, `antigram_${Date.now()}.jpg`)
    return
  }
  // Fallback: fetch → blob → anchor download
  try {
    const res = await fetch(photoUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `antigram_${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    window.open(photoUrl, '_blank')
  }
}

function sharePhoto(momentId: string) {
  const url = `${window.location.origin}/moment/${momentId}`
  if (navigator.share) {
    navigator.share({ url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(url).catch(() => {})
  }
}

export function MomentFeedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const state = location.state as FeedState | null

  const moments: Moment[] = state?.moments ?? []
  const startIndex: number = state?.startIndex ?? 0
  const isOwner: boolean = state?.isOwner ?? false

  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const [localMoments, setLocalMoments] = useState<Moment[]>(moments)
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCounts>>({})
  const [myReactions, setMyReactions] = useState<Record<string, ReactionType | null>>({})
  const [menuMomentId, setMenuMomentId] = useState<string | null>(null)
  const [albumPickerMomentId, setAlbumPickerMomentId] = useState<string | null>(null)
  const [albums, setAlbums] = useState<AlbumWithMoments[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // Scroll to start index on mount
  useEffect(() => {
    const el = itemRefs.current[startIndex]
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [startIndex])

  // Load reactions
  useEffect(() => {
    if (localMoments.length === 0) return
    const ids = localMoments.map(m => m.id)

    getFeedReactions(ids).then(data => {
      const counts: Record<string, ReactionCounts> = {}
      for (const r of data) {
        if (!counts[r.moment_id]) counts[r.moment_id] = {}
        counts[r.moment_id][r.type] = (counts[r.moment_id][r.type] ?? 0) + 1
      }
      setReactionCounts(counts)
    })

    if (user) {
      getUserReactionsForMoments(user.id, ids).then(data => {
        const mine: Record<string, ReactionType | null> = {}
        for (const r of data) mine[r.moment_id] = r.type
        setMyReactions(mine)
      })
    }
  }, [user, localMoments])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  async function handleReaction(momentId: string, type: ReactionType) {
    if (!user) return
    const current = myReactions[momentId]

    if (current === type) {
      // Remove reaction
      setMyReactions(prev => ({ ...prev, [momentId]: null }))
      setReactionCounts(prev => {
        const c = { ...prev[momentId] }
        const n = (c[type] ?? 1) - 1
        if (n <= 0) delete c[type]; else c[type] = n
        return { ...prev, [momentId]: c }
      })
      await removeReaction(momentId, user.id)
    } else {
      // Add/switch reaction
      if (current) {
        setReactionCounts(prev => {
          const c = { ...prev[momentId] }
          const n = (c[current] ?? 1) - 1
          if (n <= 0) delete c[current]; else c[current] = n
          return { ...prev, [momentId]: c }
        })
      }
      setMyReactions(prev => ({ ...prev, [momentId]: type }))
      setReactionCounts(prev => {
        const c = { ...prev[momentId] }
        c[type] = (c[type] ?? 0) + 1
        return { ...prev, [momentId]: c }
      })
      await addReaction(momentId, user.id, type)
      trackReactionAdded(type)
    }
  }

  async function handleDelete(momentId: string) {
    await deleteMoment(momentId)
    setLocalMoments(prev => prev.filter(m => m.id !== momentId))
    setMenuMomentId(null)
    if (localMoments.length <= 1) navigate(-1)
  }

  async function handleAddToAlbum(momentId: string) {
    if (!user) return
    setMenuMomentId(null)
    const al = await getUserAlbums(user.id)
    setAlbums(al)
    setAlbumPickerMomentId(momentId)
  }

  async function handleAlbumPick(albumId: string) {
    if (!albumPickerMomentId) return
    await addMomentToAlbum(albumId, albumPickerMomentId)
    setAlbumPickerMomentId(null)
    showToast('Добавлено в альбом')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed',
          top: 'calc(var(--tg-top, 56px) + 8px)',
          left: 12, zIndex: 50,
          background: 'rgba(20,14,10,0.85)',
          borderRadius: 20, padding: '6px 14px',
          border: '1px solid #2E2218',
          color: '#fff', fontSize: 14, cursor: 'pointer',
          backdropFilter: 'blur(6px)',
        }}
      >
        ← Назад
      </button>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        {localMoments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Нет моментов</p>
          </div>
        ) : (
          localMoments.map((m, i) => (
            <ShotCard
              key={m.id}
              moment={m}
              cardRef={el => { itemRefs.current[i] = el }}
              reactionCounts={reactionCounts[m.id] ?? {}}
              myReaction={myReactions[m.id] ?? null}
              onReaction={type => handleReaction(m.id, type)}
              onMenu={() => setMenuMomentId(m.id)}
              onShare={() => { sharePhoto(m.id); showToast('Ссылка скопирована') }}
              onSave={() => { savePhoto(m.photo_url).then(() => showToast('Сохранено')).catch(() => {}); trackMomentSaved() }}
            />
          ))
        )}
      </div>

      {/* "..." context menu bottom sheet */}
      {menuMomentId && (
        <>
          <div
            onClick={() => setMenuMomentId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#110C08', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid #2E2218',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>

            {isOwner ? (
              <>
                <MenuBtn
                  label="Добавить в альбом"
                  icon="⊞"
                  onClick={() => handleAddToAlbum(menuMomentId)}
                />
                <MenuBtn
                  label="Удалить кадр"
                  icon="✕"
                  danger
                  onClick={() => handleDelete(menuMomentId)}
                />
              </>
            ) : (
              <>
                <MenuBtn
                  label="Поделиться"
                  icon="→"
                  onClick={() => { sharePhoto(menuMomentId); showToast('Ссылка скопирована'); setMenuMomentId(null) }}
                />
                <MenuBtn
                  label="Пожаловаться"
                  icon="⚑"
                  danger
                  onClick={() => { setMenuMomentId(null); showToast('Жалоба отправлена') }}
                />
              </>
            )}

            <MenuBtn label="Отмена" icon="" muted onClick={() => setMenuMomentId(null)} />
          </div>
        </>
      )}

      {/* Album picker sheet */}
      {albumPickerMomentId && (
        <>
          <div
            onClick={() => setAlbumPickerMomentId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#110C08', borderRadius: '20px 20px 0 0',
            borderTop: '1px solid #2E2218', maxHeight: '60vh',
            display: 'flex', flexDirection: 'column',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '4px 20px 12px' }}>Добавить в альбом</p>
            <div style={{ overflowY: 'auto' }}>
              {albums.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', padding: '16px 20px', fontSize: 14 }}>Нет альбомов</p>
              ) : (
                albums.map(al => (
                  <button
                    key={al.id}
                    onClick={() => handleAlbumPick(al.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px', background: 'none', border: 'none',
                      borderBottom: '1px solid #2E1A0A', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {al.first_moment_url ? (
                      <img src={al.first_moment_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: '#1A1208', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', fontSize: 18 }}>⊞</div>
                    )}
                    <div>
                      <p style={{ color: 'var(--amber)', fontWeight: 600, fontSize: 14, margin: 0 }}>{al.title}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>{al.moments_count} кадров</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: '#1A1208', border: '1px solid var(--amber)',
          color: 'var(--amber)', fontSize: 13, fontWeight: 600,
          padding: '8px 18px', borderRadius: 20, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── ShotCard ──────────────────────────────────────────────────────────────────

interface ShotCardProps {
  moment: Moment
  cardRef: (el: HTMLDivElement | null) => void
  reactionCounts: ReactionCounts
  myReaction: ReactionType | null
  onReaction: (type: ReactionType) => void
  onMenu: () => void
  onShare: () => void
  onSave: () => void
}

function ShotCard({ moment: m, cardRef, reactionCounts, myReaction, onReaction, onMenu, onShare, onSave }: ShotCardProps) {
  const [showAllReactions, setShowAllReactions] = useState(false)

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + (b ?? 0), 0)
  const hasAnyReaction = totalReactions > 0

  return (
    <div ref={cardRef} style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Photo with "..." button */}
      <div style={{ position: 'relative' }}>
        <img
          src={m.photo_url}
          alt={m.caption ?? ''}
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        {/* "..." menu button — top right */}
        <button
          onClick={onMenu}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(20,14,10,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(4px)',
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ···
        </button>
      </div>

      {/* Caption + meta */}
      <div style={{ padding: '10px 14px 4px' }}>
        {m.mood && (
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 12, marginBottom: 6,
            background: 'rgba(196,168,130,0.12)', color: 'var(--amber)', fontSize: 12,
          }}>
            {EMOTIONS.find(e => e.type === m.mood)?.emoji ?? ''} {m.mood}
          </span>
        )}
        {m.caption && (
          <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5, margin: '0 0 4px' }}>
            {m.caption}
          </p>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
          {formatTime(m.created_at)}
        </p>
      </div>

      {/* Existing reactions summary (pills) */}
      {hasAnyReaction && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 14px 2px' }}>
          {(Object.entries(reactionCounts) as [ReactionType, number][])
            .filter(([, c]) => c > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const e = EMOTIONS.find(x => x.type === type)
              const active = myReaction === type
              return (
                <button
                  key={type}
                  onClick={() => onReaction(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 16,
                    background: active ? 'rgba(196,168,130,0.2)' : 'rgba(255,255,255,0.05)',
                    border: active ? '1px solid var(--amber)' : '1px solid #2E2218',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{e?.emoji ?? '❤️'}</span>
                  <span style={{ color: active ? 'var(--amber)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 700 : 400 }}>{count}</span>
                </button>
              )
            })}
        </div>
      )}

      {/* Reaction picker + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px' }}>
        {/* Reaction toggle */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {showAllReactions ? (
            <>
              {EMOTIONS.map(e => {
                const active = myReaction === e.type
                return (
                  <button
                    key={e.type}
                    onClick={() => { onReaction(e.type); setShowAllReactions(false) }}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      background: active ? 'rgba(196,168,130,0.2)' : 'rgba(255,255,255,0.05)',
                      border: active ? '1px solid var(--amber)' : '1px solid #2E2218',
                      fontSize: 16, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {e.emoji}
                  </button>
                )
              })}
              <button
                onClick={() => setShowAllReactions(false)}
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAllReactions(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 16,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #2E2218',
                color: myReaction ? 'var(--amber)' : 'var(--text-muted)',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15 }}>{myReaction ? (EMOTIONS.find(e => e.type === myReaction)?.emoji ?? '❤️') : '+'}</span>
              <span>{myReaction ? 'Ваша реакция' : 'Реакция'}</span>
            </button>
          )}
        </div>

        {/* Action buttons: share + save */}
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionBtn icon="→" label="Поделиться" onClick={onShare} />
          <ActionBtn icon="↓" label="Сохранить" onClick={onSave} />
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: 18,
        background: 'rgba(201,146,42,0.1)',
        border: '1px solid #2E2218',
        color: 'var(--amber)', fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  )
}

function MenuBtn({ label, icon, danger, muted, onClick }: {
  label: string; icon: string; danger?: boolean; muted?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 24px', background: 'none', border: 'none',
        borderBottom: muted ? 'none' : '1px solid #1A1208',
        color: danger ? '#e05a5a' : muted ? 'var(--text-muted)' : '#F0E8D8',
        fontSize: 15, cursor: 'pointer', textAlign: 'left',
      }}
    >
      {icon && <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{icon}</span>}
      {label}
    </button>
  )
}
