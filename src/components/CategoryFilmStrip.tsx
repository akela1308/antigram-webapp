import { useEffect, useState, useRef } from 'react'
import { getMomentsByEmotion } from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface CategoryItem {
  id: FilterValue
  label: string
  photoUrl?: string | null
}

const BASE_CATEGORIES: CategoryItem[] = [
  { id: 'for_you', label: 'Для вас' },
  ...EMOTIONS.map(e => ({ id: e.type as FilterValue, label: e.label })),
]

const FRAME_W = 80
const FRAME_H = 60

interface Props {
  active: FilterValue
  onChange: (value: FilterValue) => void
}

export function CategoryFilmStrip({ active, onChange }: Props) {
  const [categories, setCategories] = useState<CategoryItem[]>(BASE_CATEGORIES)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    async function loadThumbs() {
      const emotions = EMOTIONS.map(e => e.type)
      const results = await Promise.all(emotions.map(e => getMomentsByEmotion(e, 1)))
      setCategories(prev =>
        prev.map(cat => {
          const idx = emotions.indexOf(cat.id as ReactionType)
          if (idx === -1) return cat
          const top = results[idx]?.[0]
          return top ? { ...cat, photoUrl: top.photo_url } : cat
        })
      )
    }
    loadThumbs()
  }, [])

  return (
    <div style={{ background: 'var(--film-track)', borderBottom: '1px solid var(--film-amber-dark)' }}>
      <SprocketEdge />
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '8px 14px',
        }}
      >
        {categories.map(cat => {
          const isActive = cat.id === active
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: FRAME_W,
                  height: FRAME_H,
                  borderRadius: 6,
                  border: isActive ? '2px solid #D4891A' : '1px solid var(--film-frame-border)',
                  overflow: 'hidden',
                  background: 'var(--film-track)',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {cat.photoUrl ? (
                  <img
                    src={cat.photoUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'rgba(107,46,12,0.35)' }} />
                )}
                {!isActive && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                )}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#D4891A' : 'rgba(255,255,255,0.55)',
                  maxWidth: FRAME_W,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {cat.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SprocketEdge() {
  return (
    <div
      style={{
        height: 11,
        background: 'var(--film-amber)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        gap: 4,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 8,
            borderRadius: 2,
            background: 'var(--film-hole)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
