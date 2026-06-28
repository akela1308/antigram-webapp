import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getAlbumMoments,
  getUserMoments,
  addMomentToAlbum,
  removeMomentFromAlbum,
  deleteAlbum,
  updateAlbumTitle,
} from '../lib/db'
import type { Moment } from '../lib/types'

export function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const state = location.state as { albumTitle?: string; userId?: string } | null

  const [albumMoments, setAlbumMoments] = useState<Moment[]>([])
  const [allMoments, setAllMoments] = useState<Moment[]>([])
  const [albumTitle, setAlbumTitle] = useState(state?.albumTitle ?? 'Альбом')
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameValue, setRenameValue] = useState(albumTitle)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!albumId) return
    setLoading(true)
    const [am, um] = await Promise.all([
      getAlbumMoments(albumId),
      user ? getUserMoments(user.id) : Promise.resolve([]),
    ])
    setAlbumMoments(am)
    setAllMoments(um)
    setLoading(false)
  }, [albumId, user])

  useEffect(() => { load() }, [load])

  const handleRename = async () => {
    if (!albumId || !renameValue.trim()) return
    await updateAlbumTitle(albumId, renameValue.trim())
    setAlbumTitle(renameValue.trim())
    setShowRename(false)
    setShowMenu(false)
  }

  const handleDeleteAlbum = async () => {
    if (!albumId) return
    await deleteAlbum(albumId)
    navigate(-1)
  }

  const handleAddMoment = async (momentId: string) => {
    if (!albumId) return
    await addMomentToAlbum(albumId, momentId)
    setShowAddPicker(false)
    const am = await getAlbumMoments(albumId)
    setAlbumMoments(am)
  }

  const handleRemoveMoment = async (momentId: string) => {
    if (!albumId) return
    await removeMomentFromAlbum(albumId, momentId)
    setRemoveConfirmId(null)
    const am = await getAlbumMoments(albumId)
    setAlbumMoments(am)
  }

  const albumMomentIds = new Set(albumMoments.map(m => m.id))
  const availableMoments = allMoments.filter(m => !albumMomentIds.has(m.id))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}
        >
          ←
        </button>
        <h2 style={{ color: 'var(--text)', fontSize: 17, fontWeight: 700, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {albumTitle.startsWith('#') ? albumTitle : `#${albumTitle}`}
        </h2>
        <button
          onClick={() => setShowMenu(prev => !prev)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', padding: '0 4px', position: 'relative' }}
        >
          ⋯
          {showMenu && (
            <div style={{
              position: 'absolute', top: 32, right: 0,
              background: '#1A1208', border: '1px solid #2E1A0A',
              borderRadius: 10, overflow: 'hidden',
              minWidth: 160, zIndex: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}>
              <button
                onClick={e => { e.stopPropagation(); setRenameValue(albumTitle); setShowRename(true); setShowMenu(false) }}
                style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: '1px solid #2E1A0A', textAlign: 'left', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}
              >
                Переименовать
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); setShowMenu(false) }}
                style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', textAlign: 'left', color: '#e05a5a', fontSize: 14, cursor: 'pointer' }}
              >
                Удалить альбом
              </button>
            </div>
          )}
        </button>
      </div>

      {/* Add button */}
      <div style={{ padding: '12px 16px' }}>
        <button
          onClick={() => setShowAddPicker(true)}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 30,
            background: 'var(--amber)', color: '#140E0A',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
          }}
        >
          + Добавить фото
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '0 2px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '1' }} />
          ))}
        </div>
      ) : albumMoments.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 12 }}>
          <span style={{ fontSize: 40 }}>📷</span>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Альбом пуст</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '0 2px 112px' }}>
          {albumMoments.map(m => (
            <div
              key={m.id}
              style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setRemoveConfirmId(prev => prev === m.id ? null : m.id)}
            >
              <img
                src={m.photo_url}
                alt=""
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  filter: removeConfirmId === m.id ? 'brightness(0.4)' : undefined,
                  transition: 'filter 0.15s',
                }}
                draggable={false}
              />
              {removeConfirmId === m.id && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleRemoveMoment(m.id)}
                    style={{ padding: '7px 14px', borderRadius: 16, background: '#e05a5a', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Убрать
                  </button>
                  <button
                    onClick={() => setRemoveConfirmId(null)}
                    style={{ padding: '5px 12px', borderRadius: 16, background: 'rgba(0,0,0,0.5)', border: '1px solid #555', color: '#ccc', fontSize: 11, cursor: 'pointer' }}
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rename bottom sheet */}
      {showRename && (
        <>
          <div onClick={() => setShowRename(false)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08', borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218', padding: '12px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>Переименовать</p>
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 12,
                background: '#1A1208', color: '#fff', border: '1px solid var(--amber)',
                fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleRename}
              disabled={!renameValue.trim()}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 30, marginTop: 12,
                background: renameValue.trim() ? 'var(--amber)' : '#2E1A0A',
                color: renameValue.trim() ? '#140E0A' : '#555',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              Сохранить
            </button>
          </div>
        </>
      )}

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08', borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218',
            padding: '24px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
          }}>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Удалить альбом?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px', textAlign: 'center' }}>Фотографии останутся в ленте</p>
            <button
              onClick={handleDeleteAlbum}
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

      {/* Add photo picker */}
      {showAddPicker && (
        <>
          <div onClick={() => setShowAddPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: '#110C08', borderRadius: '24px 24px 0 0',
            borderTop: '1px solid #2E2218',
            maxHeight: '70vh', display: 'flex', flexDirection: 'column',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 20px))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>
            <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Добавить фото</p>
              <button onClick={() => setShowAddPicker(false)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {availableMoments.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Все фото уже добавлены</p>
              </div>
            ) : (
              <div className="no-scrollbar" style={{ overflowY: 'auto', padding: '0 8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {availableMoments.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleAddMoment(m.id)}
                      style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid #2E1A0A' }}
                    >
                      <img src={m.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
