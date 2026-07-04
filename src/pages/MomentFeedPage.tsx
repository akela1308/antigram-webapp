import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { StarSupportButton } from '../components/StarSupportButton'
import { useAuth } from '../contexts/AuthContext'
import { formatRelativeTime, useLanguage } from '../contexts/LanguageContext'
import {
  getFeedReactions,
  getUserReactionsForMoments,
  getMomentStarTotals,
  addReaction,
  removeReaction,
  deleteMoment,
  getUserAlbums,
  addMomentToAlbum,
  adminShadowBanUser,
  reportMoment,
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

async function savePhoto(photoUrl: string): Promise<void> {
  const tg = (window as any).Telegram?.WebApp
  // Bot API 8.0+ native download
  if (typeof tg?.downloadFile === 'function') {
    tg.downloadFile(photoUrl, `antigram_${Date.now()}.jpg`)
    return
  }
  // In Telegram: open link so user can long-press to save
  if (typeof tg?.openLink === 'function') {
    tg.openLink(photoUrl)
    return
  }
  // Browser fallback: open in new tab
  window.open(photoUrl, '_blank')
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
  const { user, profile: myProfile } = useAuth()
  const { t } = useLanguage()
  const isAdmin = myProfile?.is_admin === true
  const state = location.state as FeedState | null

  const moments: Moment[] = state?.moments ?? []
  const startIndex: number = state?.startIndex ?? 0
  const isOwner: boolean = state?.isOwner ?? false

  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const [localMoments, setLocalMoments] = useState<Moment[]>(moments)
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCounts>>({})
  const [myReactions, setMyReactions] = useState<Record<string, ReactionType | null>>({})
  const [starTotals, setStarTotals] = useState<Record<string, number>>({})
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

    getMomentStarTotals(ids).then(setStarTotals)

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

  async function handleReport(momentId: string) {
    if (!user) {
      setMenuMomentId(null)
      showToast(t('moment.reportSignIn'))
      return
    }

    const { error } = await reportMoment(momentId, user.id)
    setMenuMomentId(null)
    if (error) {
      console.error('[Report] failed:', error)
      showToast(t('moment.reportFailed'))
      return
    }

    showToast(t('moment.reportSent'))
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
    showToast(t('moment.addedToAlbum'))
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
        ← {t('common.back')}
      </button>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>
        {localMoments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{t('profile.noMoments')}</p>
          </div>
        ) : (
          localMoments.map((m, i) => (
            <ShotCard
              key={m.id}
              moment={m}
              cardRef={el => { itemRefs.current[i] = el }}
              reactionCounts={reactionCounts[m.id] ?? {}}
              myReaction={myReactions[m.id] ?? null}
              starTotal={starTotals[m.id] ?? 0}
              onStarTotalChange={(total) => setStarTotals(prev => ({ ...prev, [m.id]: total }))}
              onReaction={type => handleReaction(m.id, type)}
              onMenu={() => setMenuMomentId(m.id)}
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

            {/* Common actions for everyone */}
            {(() => {
              const menuMoment = localMoments.find(m => m.id === menuMomentId)
              return (
                <>
                  <MenuBtn
                    label={t('moment.download')}
                    icon="↓"
                    onClick={() => {
                      if (menuMoment) savePhoto(menuMoment.photo_url).then(() => showToast(t('moment.openingPhoto'))).catch(() => {})
                      trackMomentSaved()
                      setMenuMomentId(null)
                    }}
                  />
                  <MenuBtn
                    label={t('moment.share')}
                    icon="→"
                    onClick={() => { sharePhoto(menuMomentId!); showToast(t('moment.linkCopied')); setMenuMomentId(null) }}
                  />
                </>
              )
            })()}
            {isOwner ? (
              <>
                <MenuBtn
                  label={t('moment.addToAlbum')}
                  icon="⊞"
                  onClick={() => handleAddToAlbum(menuMomentId)}
                />
                <MenuBtn
                  label={t('profile.deleteFrame')}
                  icon="✕"
                  danger
                  onClick={() => handleDelete(menuMomentId)}
                />
              </>
            ) : (
              <>
                <MenuBtn
                  label={t('moment.report')}
                  icon="⚑"
                  danger
                  onClick={() => handleReport(menuMomentId)}
                />
                {isAdmin && (() => {
                  const menuMoment = localMoments.find(m => m.id === menuMomentId)
                  return (
                    <>
                      <MenuBtn
                        label={t('moment.adminDelete')}
                        icon=""
                        danger
                        onClick={() => handleDelete(menuMomentId)}
                      />
                      <MenuBtn
                        label={t('moment.adminShadowBan')}
                        icon=""
                        danger
                        onClick={async () => {
                          if (!menuMoment) return
                          await adminShadowBanUser(menuMoment.user_id)
                          setMenuMomentId(null)
                          showToast(t('moment.shadowBanned'))
                        }}
                      />
                    </>
                  )
                })()}
              </>
            )}

            <MenuBtn label={t('common.cancel')} icon="" muted onClick={() => setMenuMomentId(null)} />
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
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '4px 20px 12px' }}>{t('moment.addToAlbum')}</p>
            <div style={{ overflowY: 'auto' }}>
              {albums.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', padding: '16px 20px', fontSize: 14 }}>{t('moment.noAlbums')}</p>
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
                      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>{t('profile.framesCount', { count: al.moments_count })}</p>
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
  starTotal: number
  onStarTotalChange: (total: number) => void
  onReaction: (type: ReactionType) => void
  onMenu: () => void
}

function ShotCard({ moment: m, cardRef, reactionCounts, myReaction, starTotal, onStarTotalChange, onReaction, onMenu }: ShotCardProps) {
  const { language, t } = useLanguage()
  const [showAllReactions, setShowAllReactions] = useState(false)

  const myReactionMeta = getReactionMeta(myReaction, m, t)
  const customMoodMeta = getCustomMoodMeta(m)
  const reactionEntries = getReactionEntries(reactionCounts, m, t)
  const myReactionIsDisplayed = Boolean(myReaction && reactionEntries.some(entry => entry.type === myReaction))

  return (
    <div ref={cardRef} style={{ marginBottom: 8, borderBottom: '8px solid #080503' }}>
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

      <div style={{ padding: '10px 14px 14px' }}>
        {m.caption && (
          <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px' }}>
            {m.caption}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              minWidth: 0,
              flex: 1,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {showAllReactions ? (
              <>
                {EMOTIONS.map(e => {
                  const active = myReaction === e.type
                  return (
                    <button
                      key={e.type}
                      onClick={() => { onReaction(e.type); setShowAllReactions(false) }}
                      style={reactionPillStyle(active)}
                    >
                      <span style={{ fontSize: 15 }}>{e.emoji}</span>
                      <span>{t(`emotion.${e.type}`)}</span>
                    </button>
                  )
                })}
                {customMoodMeta && (
                  <button
                    onClick={() => { onReaction('custom'); setShowAllReactions(false) }}
                    style={reactionPillStyle(myReaction === 'custom', true)}
                  >
                    <span style={{ fontSize: 15 }}>{customMoodMeta.emoji}</span>
                    <span>{customMoodMeta.label}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAllReactions(false)}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    background: 'none', border: 'none',
                    color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                {reactionEntries.map(entry => {
                  const active = myReaction === entry.type
                  return (
                    <button
                      key={entry.type}
                      onClick={() => {
                        if (active) {
                          setShowAllReactions(true)
                        } else {
                          onReaction(entry.type)
                        }
                      }}
                      style={reactionPillStyle(active, entry.synthetic)}
                    >
                      <span style={{ fontSize: 14 }}>{entry.emoji}</span>
                      <span>{entry.label}</span>
                      <span style={{ fontWeight: 800 }}>{entry.count}</span>
                    </button>
                  )
                })}
                {!myReactionIsDisplayed && (
                  <button
                    onClick={() => setShowAllReactions(true)}
                    style={reactionPillStyle(!!myReactionMeta)}
                  >
                    <span style={{ fontSize: 15 }}>{myReactionMeta ? myReactionMeta.emoji : '+'}</span>
                    <span>{myReactionMeta ? myReactionMeta.label : t('moment.reaction')}</span>
                  </button>
                )}
              </>
            )}
            <StarSupportButton
              momentId={m.id}
              initialTotal={starTotal}
              variant="soft"
              onTotalChange={onStarTotalChange}
            />
          </div>

          <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
            {formatRelativeTime(m.created_at, language)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

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

function getCustomMoodMeta(moment: Moment): { emoji: string; label: string } | null {
  if (!moment.custom_mood_emoji || !moment.custom_mood_label) return null
  return { emoji: moment.custom_mood_emoji, label: moment.custom_mood_label }
}

function getReactionMeta(type: ReactionType | null | undefined, moment: Moment, t: (key: string) => string): { emoji: string; label: string } | null {
  if (!type) return null
  if (type === 'custom') return getCustomMoodMeta(moment)
  const emotion = EMOTIONS.find(e => e.type === type)
  return emotion ? { emoji: emotion.emoji, label: t(`emotion.${emotion.type}`) } : null
}

function getReactionEntries(reactionCounts: ReactionCounts, moment: Moment, t: (key: string) => string): Array<{
  type: ReactionType
  emoji: string
  label: string
  count: number
  synthetic?: boolean
}> {
  type ReactionEntry = {
    type: ReactionType
    emoji: string
    label: string
    count: number
    synthetic?: boolean
  }

  const entries = (Object.entries(reactionCounts) as [ReactionType, number][])
    .filter(([, count]) => count > 0)
    .map(([type, count]) => {
      const meta = getReactionMeta(type, moment, t)
      return meta ? { type, ...meta, count } : null
    })
    .filter(Boolean) as ReactionEntry[]

  const moodType = moment.mood as ReactionType | null
  if (moodType && !entries.some(entry => entry.type === moodType)) {
    const moodMeta = getReactionMeta(moodType, moment, t)
    if (moodMeta) {
      entries.unshift({ type: moodType, ...moodMeta, count: 1, synthetic: true })
    }
  }

  return entries.sort((a, b) => b.count - a.count)
}

function reactionPillStyle(active: boolean, custom = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 36,
    padding: '0 11px',
    borderRadius: 18,
    background: active ? 'rgba(196,168,130,0.2)' : custom ? 'rgba(196,168,130,0.08)' : 'rgba(255,255,255,0.05)',
    border: active ? '1px solid var(--amber)' : custom ? '1px solid rgba(196,168,130,0.4)' : '1px solid #2E2218',
    color: active ? 'var(--amber)' : 'var(--text-muted)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }
}
