import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Moment } from '../lib/types'

export function MomentFeedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { moments?: Moment[]; startIndex?: number } | null

  const moments: Moment[] = state?.moments ?? []
  const startIndex: number = state?.startIndex ?? 0

  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const el = itemRefs.current[startIndex]
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, [startIndex])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 56px)' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed',
          top: 'calc(var(--tg-top, 56px) + 8px)',
          left: 12,
          zIndex: 50,
          background: 'rgba(20,14,10,0.85)',
          borderRadius: 20,
          padding: '6px 12px',
          border: '1px solid #2E2218',
          color: '#fff',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ← Назад
      </button>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {moments.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Нет моментов</p>
          </div>
        ) : (
          moments.map((m, i) => (
            <div
              key={m.id}
              ref={el => { itemRefs.current[i] = el }}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {/* Photo */}
              <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden' }}>
                <img
                  src={m.photo_url}
                  alt={m.caption ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div style={{ padding: '12px 16px' }}>
                {m.mood && (
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: 'rgba(196,168,130,0.12)',
                    color: 'var(--amber)',
                    fontSize: 12,
                    marginBottom: 8,
                  }}>
                    {m.mood}
                  </span>
                )}
                {m.caption && (
                  <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5, margin: '0 0 6px' }}>
                    {m.caption}
                  </p>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
                  {new Date(m.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom padding */}
      <div style={{ height: 112 }} />
    </div>
  )
}
