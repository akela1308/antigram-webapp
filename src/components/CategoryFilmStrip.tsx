import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { getFollowingCategoryThumbnails, getGlobalCategoryThumbnails } from '../lib/db'
import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface CategoryItem {
  id: FilterValue
  photoUrl?: string | null
}

const BASE_CATEGORIES: CategoryItem[] = [
  { id: 'for_you' },
  ...EMOTIONS.map(e => ({ id: e.type as FilterValue })),
]

const FRAME_W = 80
const FRAME_H = 60
const GAP = 8
const SNAP = FRAME_W + GAP
const COPIES = 3

interface Props {
  active: FilterValue
  onChange: (value: FilterValue) => void
  thumbnailScope?: 'global' | 'following'
  userId?: string | null
}

export function CategoryFilmStrip({
  active,
  onChange,
  thumbnailScope = 'global',
  userId = null,
}: Props) {
  const { t } = useLanguage()
  const [categories, setCategories] = useState<CategoryItem[]>(BASE_CATEGORIES)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ringSize = categories.length
  const virtualCategories = ringSize > 0
    ? Array.from({ length: ringSize * COPIES }, (_, i) => categories[i % ringSize])
    : []
  const middleStart = ringSize

  function checkLoop() {
    const el = containerRef.current
    if (!el || ringSize === 0) return

    const snapIdx = Math.round(el.scrollLeft / SNAP)
    if (snapIdx < ringSize) {
      el.scrollLeft += ringSize * SNAP
    } else if (snapIdx >= ringSize * 2) {
      el.scrollLeft -= ringSize * SNAP
    }
  }

  function handleScroll() {
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(checkLoop, 80)
  }

  useEffect(() => {
    let cancelled = false
    setCategories(BASE_CATEGORIES)

    async function loadThumbs() {
      const thumbnails = thumbnailScope === 'following' && userId
        ? await getFollowingCategoryThumbnails(userId)
        : await getGlobalCategoryThumbnails()

      if (cancelled) return

      setCategories(prev =>
        prev.map(cat => ({ ...cat, photoUrl: thumbnails[cat.id] ?? null }))
      )
    }

    loadThumbs()

    return () => { cancelled = true }
  }, [thumbnailScope, userId])

  useEffect(() => {
    const el = containerRef.current
    if (!el || ringSize === 0) return

    const timer = setTimeout(() => {
      el.scrollLeft = middleStart * SNAP
    }, 30)

    return () => clearTimeout(timer)
  }, [middleStart, ringSize])

  useEffect(() => {
    return () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    }
  }, [])

  return (
    <div style={{ background: 'var(--film-track)', borderBottom: '1px solid var(--film-amber-dark)' }}>
      <SprocketEdge />
      <div
        ref={containerRef}
        className="no-scrollbar"
        onScroll={handleScroll}
        style={{
          display: 'flex',
          gap: GAP,
          overflowX: 'scroll',
          overflowY: 'hidden',
          padding: '8px 14px',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
        }}
      >
        {virtualCategories.map((cat, virtualIndex) => {
          const isActive = cat.id === active
          const label = cat.id === 'for_you' ? t('category.forYou') : t(`emotion.${cat.id}`)
          return (
            <button
              key={`${cat.id}-${virtualIndex}`}
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
                scrollSnapAlign: 'start',
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
                {label}
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
