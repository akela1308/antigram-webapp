import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { FILM_PRESETS } from '../lib/filmPresets'
import type { FilmPreset } from '../lib/filmPresets'
import { getUnreadNotificationsCount } from '../lib/db'

const ACTIVE = '#C9843E'
const INACTIVE = '#8A6A50'

export function BottomNav() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [showPicker, setShowPicker] = useState(false)
  const [selected, setSelected] = useState<FilmPreset>(FILM_PRESETS[1])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true

    async function refreshUnreadCount() {
      if (!user) {
        setUnreadCount(0)
        return
      }

      const count = await getUnreadNotificationsCount(user.id)
      if (active) setUnreadCount(count)
    }

    refreshUnreadCount()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }
    const handleNotificationsRead = () => setUnreadCount(0)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('antigram:notifications-read', handleNotificationsRead)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('antigram:notifications-read', handleNotificationsRead)
    }
  }, [user])

  function openCamera() {
    if (!user) { navigate('/auth'); return }
    setShowPicker(true)
  }

  function loadFilm(preset: FilmPreset) {
    setShowPicker(false)
    navigate('/upload', { state: { filmId: preset.id } })
  }

  function skipFilm() {
    setShowPicker(false)
    navigate('/upload', { state: { filmId: 'none' } })
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 flex justify-around items-end z-50"
        style={{
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--border)',
          height: 85,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          paddingTop: 8,
        }}
      >
        <NavLink to="/" end className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
          {({ isActive }) => <HomeIcon active={isActive} />}
        </NavLink>

        <NavLink to="/search" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
          {({ isActive }) => <SearchIcon active={isActive} />}
        </NavLink>

        {/* Center [A] FAB */}
        <button
          onClick={openCamera}
          className="flex flex-col items-center justify-end pb-1 transition-transform active:scale-90"
          style={{ marginBottom: 1 }}
        >
          <div
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{ width: 64, height: 64, background: '#2E1A0A', marginTop: -26 }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 50, height: 50, background: '#C4A882' }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: 18, fontWeight: 800, color: '#1A0F05', letterSpacing: 0, lineHeight: 1,
                }}
              >
                [A]
              </span>
            </div>
          </div>
        </button>

        <NavLink to="/notifications" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
          {({ isActive }) => (
            <div style={{ position: 'relative', width: 24, height: 24 }}>
              <BellIcon active={isActive} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -1,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    background: '#E55445',
                    border: '2px solid rgba(20,14,10,0.95)',
                  }}
                />
              )}
            </div>
          )}
        </NavLink>

        <NavLink to="/me" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
          {({ isActive }) => <PersonIcon active={isActive} />}
        </NavLink>
      </nav>

      {/* Film picker bottom sheet */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowPicker(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 100,
              background: '#110C08',
              borderRadius: '24px 24px 0 0',
              borderTop: '1px solid #2E2218',
              paddingBottom: 'max(32px, env(safe-area-inset-bottom, 20px))',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
            </div>

            {/* Title */}
            <div style={{ padding: '12px 20px 8px' }}>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: 0.2 }}>
                {t('filmPicker.title')}
              </p>
              <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>
                {t('filmPicker.hint')}
              </p>
            </div>

            {/* Film scroll */}
            <div
              className="no-scrollbar"
              style={{
                display: 'flex', gap: 12, overflowX: 'auto',
                padding: '12px 20px 16px', alignItems: 'flex-start',
              }}
            >
              {FILM_PRESETS.map(preset => {
                const active = selected.id === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelected(preset)}
                    style={{
                      flexShrink: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    {/* Film icon */}
                    <div
                      style={{
                        width: 64, height: 64, borderRadius: 32,
                        border: active ? '3px solid var(--amber)' : '2px solid #2E2218',
                        overflow: 'hidden',
                        background: preset.iconUrl ? 'transparent' : preset.id === 'none' ? '#1A1A1A' : preset.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      {preset.iconUrl ? (
                        <img
                          src={preset.iconUrl}
                          alt={preset.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 32 }}
                        />
                      ) : (
                        <>
                          <div style={{
                            width: 24, height: 24, borderRadius: 12,
                            background: 'rgba(0,0,0,0.35)',
                            border: '1.5px solid rgba(255,255,255,0.15)',
                          }} />
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: 32,
                            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.18) 0%, transparent 65%)',
                            pointerEvents: 'none',
                          }} />
                        </>
                      )}
                    </div>
                    <span
                      style={{
                        color: active ? 'var(--amber)' : '#888',
                        fontSize: 10, fontWeight: active ? 700 : 400,
                        textAlign: 'center', lineHeight: 1.3, maxWidth: 64,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    >
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Selected film name */}
            <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: 0 }}>
                {selected.name}
              </p>
            </div>

            {/* Buttons */}
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => loadFilm(selected)}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 30,
                  background: 'var(--amber)', color: '#140E0A',
                  fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >
                {t('filmPicker.load')}
              </button>
              <button
                onClick={skipFilm}
                style={{
                  width: '100%', padding: '12px 0',
                  background: 'none', border: 'none',
                  color: '#555', fontSize: 14, cursor: 'pointer',
                }}
              >
                {t('common.noFilter')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function SearchIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function BellIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </svg>
  )
}
