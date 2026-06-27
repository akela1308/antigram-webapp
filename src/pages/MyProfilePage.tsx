import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { FilmStripHeader } from '../components/FilmStripHeader'
import { ProfileSkeleton, MomentCardSkeleton } from '../components/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserMoments,
  getFollowersCount,
  getFollowingCount,
  getHighlights,
  setHighlightAtPosition,
  removeHighlightAtPosition,
  getUserAlbums,
  createAlbum,
  deleteMoment,
  updateProfile,
} from '../lib/db'
import type { Moment, HighlightWithMoment, AlbumWithMoments } from '../lib/types'

// ── Grid layout ───────────────────────────────────────────────────────────────

type GridRow =
  | { type: 'pair'; key: string; left: Moment; right: Moment | null }
  | { type: 'full'; key: string; item: Moment }

function buildGridRows(moments: Moment[]): GridRow[] {
  const rows: GridRow[] = []
  let i = 0
  while (i < moments.length) {
    if (i % 5 === 4) {
      rows.push({ type: 'full', key: moments[i].id, item: moments[i] })
      i++
    } else {
      rows.push({ type: 'pair', key: moments[i].id, left: moments[i], right: moments[i + 1] ?? null })
      i += 2
    }
  }
  return rows
}

// ── Main component ────────────────────────────────────────────────────────────

export function MyProfilePage() {
  const { user, profile, loading: authLoading, signOut, isTelegram, telegramUser, loginWithTelegram, telegramAuthLoading } = useAuth()
  const navigate = useNavigate()

  const [moments, setMoments] = useState<Moment[]>([])
  const [highlights, setHighlights] = useState<HighlightWithMoment[]>([])
  const [albums, setAlbums] = useState<AlbumWithMoments[]>([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'film' | 'albums'>('film')
  const [pickerTarget, setPickerTarget] = useState<number | null>(null)
  const [showCreateAlbum, setShowCreateAlbum] = useState(false)
  const [newAlbumTitle, setNewAlbumTitle] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const longPressTimer = { current: null as ReturnType<typeof setTimeout> | null }

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const [m, hl, al, fc, fgc] = await Promise.all([
      getUserMoments(user.id),
      getHighlights(user.id),
      getUserAlbums(user.id),
      getFollowersCount(user.id),
      getFollowingCount(user.id),
    ])
    setMoments(m)
    setHighlights(hl)
    setAlbums(al)
    setFollowersCount(fc)
    setFollowingCount(fgc)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleHighlightPick = async (momentId: string) => {
    if (!user || pickerTarget === null) return
    const slot = pickerTarget  // capture before any state changes

    // Optimistic update
    const pickedMoment = moments.find(m => m.id === momentId)
    if (pickedMoment) {
      setHighlights(prev => {
        const without = prev.filter(h => h.position !== slot)
        return [...without, {
          id: `optimistic-${Date.now()}`,
          user_id: user.id,
          moment_id: momentId,
          position: slot,
          created_at: new Date().toISOString(),
          moments: { id: momentId, photo_url: pickedMoment.photo_url },
        }]
      })
    }

    setPickerTarget(null)
    const { error } = await setHighlightAtPosition(user.id, momentId, slot)
    if (error) {
      console.error('setHighlightAtPosition error:', error)
      showToast('Ошибка сохранения')
      const hl = await getHighlights(user.id)
      setHighlights(hl)
      return
    }

    const hl = await getHighlights(user.id)
    setHighlights(hl)
    showToast('Фото добавлено в плёнку')
  }

  const handleHighlightRemove = async (slotIndex: number) => {
    if (!user) return
    await removeHighlightAtPosition(user.id, slotIndex)
    const hl = await getHighlights(user.id)
    setHighlights(hl)
  }

  const handleCreateAlbum = async () => {
    if (!user || !newAlbumTitle.trim()) return
    await createAlbum(user.id, newAlbumTitle.trim())
    setShowCreateAlbum(false)
    setNewAlbumTitle('')
    const al = await getUserAlbums(user.id)
    setAlbums(al)
  }

  const handleDeleteMoment = async (momentId: string) => {
    await deleteMoment(momentId)
    setDeleteConfirmId(null)
    const m = await getUserMoments(user!.id)
    setMoments(m)
    const hl = await getHighlights(user!.id)
    setHighlights(hl)
  }

  function startLongPress(momentId: string) {
    longPressTimer.current = setTimeout(() => {
      setDeleteConfirmId(momentId)
    }, 600)
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  // ── Loading / not-logged-in guards ─────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--brown)', fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Georgia, serif' }}>Мой профиль</h2>
        </div>
        <ProfileSkeleton />
        <div style={{ padding: '0 12px' }} className="grid grid-cols-2 gap-2">
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
            style={{ background: 'var(--amber)', color: '#140E0A', opacity: telegramAuthLoading ? 0.7 : 1 }}
          >
            {telegramAuthLoading ? 'Входим...' : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#140E0A">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                Войти как {tgName ?? tgUsername ?? 'Telegram'}
              </>
            )}
          </button>
        ) : (
          <Link to="/auth" className="px-8 py-3 rounded-xl font-semibold text-sm" style={{ background: 'var(--amber)', color: '#140E0A' }}>
            Войти
          </Link>
        )}
      </div>
    )
  }

  const displayName = profile.display_name ?? profile.username ?? telegramUser?.first_name ?? 'Аноним'

  const ringPhotos: (string | null)[] = Array.from({ length: 5 }, (_, i) => {
    const hl = highlights.find(h => h.position === i)
    return hl?.moments?.photo_url ?? null
  })

  const gridRows = buildGridRows(moments)

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>

      {/* Sticky header */}
      <div
        className="sticky z-40 flex items-center justify-between px-4 py-3"
        style={{
          top: 'var(--tg-top, 56px)',
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h2 style={{ color: 'var(--brown)', fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Georgia, serif' }}>Мой профиль</h2>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'rgba(255,255,255,0.05)', border: 'none',
            color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ⚙
        </button>
      </div>

      {/* Film strip highlights */}
      <FilmStripHeader
        photos={ringPhotos}
        isOwner
        onReplaceRequest={i => setPickerTarget(i)}
        onOpenPhoto={i => {
          const hl = highlights.find(h => h.position === i)
          if (hl?.moments?.id) navigate(`/moment/${hl.moments.id}`)
        }}
        onRemoveRequest={handleHighlightRemove}
      />

      {ringPhotos.every(p => !p) && (
        <div style={{
          margin: '8px 16px',
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(212,137,26,0.08)',
          border: '1px solid rgba(212,137,26,0.2)',
        }}>
          <p style={{ color: '#D4891A', fontSize: 12, margin: 0, textAlign: 'center' }}>
            Выберите 5 фото для плёнки — нажмите + на кадр
          </p>
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-2 pt-4 pb-2 px-6">
        {isTelegram && telegramUser?.photo_url ? (
          <img src={telegramUser.photo_url} alt={displayName} className="rounded-full object-cover" style={{ width: 72, height: 72 }} />
        ) : (
          <Avatar url={profile.avatar_url} name={displayName} size={72} />
        )}

        <div className="text-center">
          <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700, margin: 0 }}>{displayName}</h2>
          {profile.username && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '3px 0 0' }}>@{profile.username}</p>
          )}
          {isTelegram && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--amber)">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Telegram</span>
            </div>
          )}
        </div>

        {profile.bio && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 24px', width: '100%' }}>
          <Stat label="кадры" value={moments.length} />
          <div style={{ width: 1, height: 28, background: 'var(--divider)', margin: '0 20px' }} />
          <Stat label="подписчики" value={followersCount} />
          <div style={{ width: 1, height: 28, background: 'var(--divider)', margin: '0 20px' }} />
          <Stat label="подписки" value={followingCount} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        margin: '0 0 4px',
      }}>
        {(['film', 'albums'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '10px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: activeTab === tab ? 700 : 400,
              borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'film' ? 'Мои кадры' : 'Мои альбомы'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'film' ? (
        <div style={{ padding: '8px 8px 112px' }}>
          {moments.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <span style={{ fontSize: 40 }}>📷</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Нет моментов</p>
            </div>
          ) : (
            gridRows.map(row => {
              if (row.type === 'full') {
                return (
                  <div key={row.key} style={{ margin: '0 0 8px', position: 'relative' }}>
                    <PhotoTile
                      moment={row.item}
                      moments={moments}
                      navigate={navigate}
                      onLongPress={() => setDeleteConfirmId(row.item.id)}
                      onLongPressEnd={cancelLongPress}
                      onLongPressStart={() => startLongPress(row.item.id)}
                      deleteConfirmId={deleteConfirmId}
                      onDeleteConfirm={handleDeleteMoment}
                      onDeleteCancel={() => setDeleteConfirmId(null)}
                      full
                    />
                  </div>
                )
              }
              return (
                <div key={row.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <PhotoTile
                    moment={row.left}
                    moments={moments}
                    navigate={navigate}
                    onLongPress={() => setDeleteConfirmId(row.left.id)}
                    onLongPressEnd={cancelLongPress}
                    onLongPressStart={() => startLongPress(row.left.id)}
                    deleteConfirmId={deleteConfirmId}
                    onDeleteConfirm={handleDeleteMoment}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                  />
                  {row.right ? (
                    <PhotoTile
                      moment={row.right}
                      moments={moments}
                      navigate={navigate}
                      onLongPress={() => setDeleteConfirmId(row.right!.id)}
                      onLongPressEnd={cancelLongPress}
                      onLongPressStart={() => startLongPress(row.right!.id)}
                      deleteConfirmId={deleteConfirmId}
                      onDeleteConfirm={handleDeleteMoment}
                      onDeleteCancel={() => setDeleteConfirmId(null)}
                    />
                  ) : (
                    <div style={{ flex: 1 }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div style={{ padding: '8px 8px 112px' }}>
          <AlbumsGrid
            albums={albums}
            onCreatePress={() => setShowCreateAlbum(true)}
            onAlbumPress={album => navigate(`/album/${album.id}`, { state: { albumTitle: album.title, userId: user.id } })}
          />
        </div>
      )}

      {/* Photo picker for highlight */}
      {pickerTarget !== null && (
        <>
          <div
            onClick={() => setPickerTarget(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08',
            borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218',
            maxHeight: '70vh',
            display: 'flex', flexDirection: 'column',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
                Выберите фото (слот {pickerTarget + 1})
              </p>
              <button onClick={() => setPickerTarget(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {moments.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 20px 8px', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Из моих кадров
              </p>
            )}

            <div
              className="no-scrollbar"
              style={{ overflowY: 'auto', padding: '0 8px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {moments.map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleHighlightPick(m.id)}
                    style={{
                      aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid #2E1A0A',
                    }}
                  >
                    <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
                {moments.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, gridColumn: '1/-1', padding: '8px 12px' }}>
                    Нет опубликованных кадров
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create album bottom sheet */}
      {showCreateAlbum && (
        <>
          <div onClick={() => setShowCreateAlbum(false)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08',
            borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218',
            padding: '12px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Новый альбом</p>
            <input
              value={newAlbumTitle}
              onChange={e => setNewAlbumTitle(e.target.value)}
              placeholder="Название..."
              autoFocus
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 12,
                background: '#1A1208', color: '#fff',
                border: '1px solid var(--amber)',
                fontSize: 15, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleCreateAlbum}
              disabled={!newAlbumTitle.trim()}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 30, marginTop: 12,
                background: newAlbumTitle.trim() ? 'var(--amber)' : '#2E1A0A',
                color: newAlbumTitle.trim() ? '#140E0A' : '#555',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              Создать
            </button>
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

      {/* Settings bottom sheet */}
      {showSettings && (
        <SettingsSheet
          profile={profile}
          userId={user.id}
          isTelegram={isTelegram}
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
          onSaved={async () => { await load(); showToast('Сохранено') }}
          showSignOutConfirm={showSignOutConfirm}
          setShowSignOutConfirm={setShowSignOutConfirm}
          handleSignOut={handleSignOut}
        />
      )}
    </div>
  )
}

// ── PhotoTile ─────────────────────────────────────────────────────────────────

function PhotoTile({
  moment, moments, navigate, full,
  onLongPressStart, onLongPressEnd,
  deleteConfirmId, onDeleteConfirm, onDeleteCancel,
}: {
  moment: Moment
  moments: Moment[]
  navigate: ReturnType<typeof useNavigate>
  full?: boolean
  onLongPress: () => void
  onLongPressStart: () => void
  onLongPressEnd: () => void
  deleteConfirmId: string | null
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
}) {
  const isDeleteTarget = deleteConfirmId === moment.id

  return (
    <div
      style={{
        flex: full ? undefined : 1,
        width: full ? '100%' : undefined,
        aspectRatio: '1',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
      }}
      onClick={() => {
        if (deleteConfirmId) { onDeleteCancel(); return }
        const idx = moments.findIndex(m => m.id === moment.id)
        navigate('/moment-feed', { state: { moments, startIndex: idx } })
      }}
      onContextMenu={e => { e.preventDefault(); onLongPressStart() }}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onTouchMove={onLongPressEnd}
    >
      <img
        src={moment.photo_url}
        alt=""
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          filter: isDeleteTarget ? 'brightness(0.5)' : undefined,
          transition: 'filter 0.15s',
        }}
        draggable={false}
      />
      {isDeleteTarget && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onDeleteConfirm(moment.id)}
            style={{
              padding: '8px 18px', borderRadius: 20,
              background: '#e05a5a', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Удалить кадр
          </button>
          <button
            onClick={onDeleteCancel}
            style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(0,0,0,0.5)', border: '1px solid #555',
              color: '#ccc', fontSize: 12, cursor: 'pointer',
            }}
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  )
}

// ── AlbumsGrid ────────────────────────────────────────────────────────────────

function AlbumsGrid({ albums, onCreatePress, onAlbumPress }: {
  albums: AlbumWithMoments[]
  onCreatePress: () => void
  onAlbumPress: (album: AlbumWithMoments) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {/* Saved card */}
      <AlbumCard
        cover={null}
        placeholder={<span style={{ fontSize: 28, color: 'var(--amber)' }}>⌂</span>}
        placeholderBg="rgba(201,146,42,0.12)"
        title="Сохранённые"
        subtitle=""
        onClick={() => {}}
      />

      {/* User albums */}
      {albums.map(album => (
        <AlbumCard
          key={album.id}
          cover={album.first_moment_url}
          placeholder={null}
          placeholderBg="#1A1208"
          title={album.title.startsWith('#') ? album.title : `#${album.title}`}
          subtitle={`${album.moments_count} кадров`}
          isPrivate={!album.is_public}
          onClick={() => onAlbumPress(album)}
        />
      ))}

      {/* New album card */}
      <AlbumCard
        cover={null}
        placeholder={<span style={{ fontSize: 28, color: 'var(--amber)' }}>+</span>}
        placeholderBg="#1A1208"
        title="Новая плёнка"
        subtitle=""
        muted
        onClick={onCreatePress}
      />
    </div>
  )
}

function AlbumCard({ cover, placeholder, placeholderBg, title, subtitle, isPrivate, muted, onClick }: {
  cover: string | null
  placeholder: React.ReactNode | null
  placeholderBg: string
  title: string
  subtitle: string
  isPrivate?: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid #2E1A0A',
        cursor: 'pointer',
        background: '#110C08',
      }}
    >
      {/* Cover */}
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: cover ? '#0E0804' : placeholderBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover ? (
          <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : placeholder}
        {isPrivate && (
          <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            🔒
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ color: muted ? 'var(--text-muted)' : 'var(--amber)', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '2px 0 0' }}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ── SettingsSheet ─────────────────────────────────────────────────────────────

function SettingsSheet({
  profile, userId, isTelegram,
  onClose, onSaved,
  showSignOutConfirm, setShowSignOutConfirm, handleSignOut,
}: {
  profile: import('../lib/types').Profile
  userId: string
  isTelegram: boolean
  onClose: () => void
  onSignOut: () => void
  onSaved: () => void
  showSignOutConfirm: boolean
  setShowSignOutConfirm: (v: boolean) => void
  handleSignOut: () => void
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [username, setUsername]       = useState(profile.username ?? '')
  const [website, setWebsite]         = useState(profile.website ?? '')
  const [bio, setBio]                 = useState(profile.bio ?? '')
  const [lang, setLang]               = useState<'ru' | 'en'>('ru')
  const [saving, setSaving]           = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateProfile(userId, {
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
    })
    setSaving(false)
    if (!error) { onSaved(); onClose() }
  }

  const sheetStyle: React.CSSProperties = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
    background: '#110C08',
    borderRadius: '24px 24px 0 0',
    borderTop: '1px solid #2E2218',
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom, 20px))',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    background: '#1A1208', color: '#fff',
    border: '1px solid #2E1A0A', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
    letterSpacing: 0.5, textTransform: 'uppercase', margin: '14px 0 6px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    color: 'var(--amber)', fontSize: 11, fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase',
    margin: '18px 0 4px', borderBottom: '1px solid #2E1A0A', paddingBottom: 6,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div style={sheetStyle}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
        </div>
        {/* Header */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Настройки</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '0 20px' }}>
          {/* Profile section */}
          <p style={sectionTitleStyle}>Профиль</p>
          <p style={labelStyle}>Имя</p>
          <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Как тебя зовут" maxLength={40} />
          <p style={labelStyle}>Имя пользователя</p>
          <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="username" maxLength={30} autoCapitalize="none" />
          <p style={labelStyle}>Вебсайт</p>
          <input style={inputStyle} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" maxLength={100} type="url" />
          <p style={labelStyle}>Инфо</p>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'none' }}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="О себе..."
            maxLength={150}
          />

          {/* Language */}
          <p style={sectionTitleStyle}>Язык / Language</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {(['ru', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  border: `1px solid ${lang === l ? 'var(--amber)' : '#2E1A0A'}`,
                  background: lang === l ? 'rgba(201,146,42,0.1)' : 'transparent',
                  color: lang === l ? 'var(--amber)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {l === 'ru' ? '🇷🇺  Русский' : '🇬🇧  English'}
              </button>
            ))}
          </div>

          {/* Account */}
          {!isTelegram && (
            <>
              <p style={sectionTitleStyle}>Аккаунт</p>
              <button
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'transparent', border: '1px solid #2E1A0A',
                  color: 'var(--amber)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Сменить пароль
              </button>
            </>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 30, marginTop: 20,
              background: saving ? '#2E1A0A' : 'var(--amber)',
              color: saving ? '#555' : '#140E0A',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>

          {/* Sign out */}
          <button
            onClick={() => setShowSignOutConfirm(true)}
            style={{
              width: '100%', padding: '12px 0', marginTop: 8,
              background: 'none', border: 'none',
              color: '#e05a5a', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Выйти из аккаунта
          </button>
          <div style={{ height: 8 }} />
        </div>
      </div>

      {/* Sign out confirm */}
      {showSignOutConfirm && (
        <>
          <div onClick={() => setShowSignOutConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#110C08', borderRadius: '24px 24px 0 0', borderTop: '1px solid #2E2218',
            padding: '24px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, margin: '0 0 8px', textAlign: 'center' }}>Выйти из аккаунта?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>Вы можете войти снова в любое время</p>
            <button onClick={handleSignOut} style={{ width: '100%', padding: '14px 0', borderRadius: 30, background: '#e05a5a', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 10 }}>Выйти</button>
            <button onClick={() => setShowSignOutConfirm(false)} style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
          </div>
        </>
      )}
    </>
  )
}

// ── Stat ──────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K'
  return String(n)
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>{fmt(value)}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>{label}</span>
    </div>
  )
}
