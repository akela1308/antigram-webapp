import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface FilmStripHeaderProps {
  photos: (string | null)[]
  isOwner?: boolean
  onReplaceRequest?: (slotIndex: number) => void
  onOpenPhoto?: (slotIndex: number) => void
  onRemoveRequest?: (slotIndex: number) => void
}

// ─── Design tokens (matching native FilmStripProfileHeader) ──────────────────
const AMBER_L   = '#D4891A'
const AMBER_MID = '#A05C18'
const AMBER_D   = '#6B2E0C'
const TRACK_BG  = '#0E0804'
const HOLE_BG   = '#3A1406'
const FRAME_BDR = '#6B3A12'

// ─── Layout ───────────────────────────────────────────────────────────────────
const FRAME_W = 72
const FRAME_H = 72
const GAP     = 10
const SNAP    = FRAME_W + GAP  // 82px — snapping step

// ─── Scale / opacity values ───────────────────────────────────────────────────
const S_FAR = 0.90   // 2+ positions from center
const S_ADJ = 0.96   // 1 position from center
const S_CTR = 1.12   // center

// ─── Infinite loop: 3 copies × ring photos ───────────────────────────────────
const MIN_RING_SIZE = 5
const COPIES       = 3

// ─── Sprocket edge ────────────────────────────────────────────────────────────
function SprocketEdge() {
  return (
    <div style={{
      height: 15,
      background: AMBER_MID,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 4px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: AMBER_L, opacity: 0.55, zIndex: 1, pointerEvents: 'none' }} />
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: HOLE_BG, flexShrink: 0 }} />
      ))}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, background: AMBER_D, opacity: 0.55, zIndex: 1, pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Lerp helper ─────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

export function FilmStripHeader({
  photos,
  isOwner,
  onReplaceRequest,
  onOpenPhoto,
  onRemoveRequest,
}: FilmStripHeaderProps) {
  const { t } = useLanguage()
  const [menuSlot, setMenuSlot] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs     = useRef<(HTMLDivElement | null)[]>([])
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Normalise to at least 5 slots, build 3-copy virtual list
  const ringSize = Math.max(MIN_RING_SIZE, photos.length)
  const total = ringSize * COPIES
  const middleStart = ringSize
  const ring: (string | null)[] = Array.from({ length: ringSize }, (_, i) => photos[i] ?? null)
  const virtualData = Array.from({ length: total }, (_, i) => ring[i % ringSize])

  // ── Scale / opacity update (direct DOM — no React re-render) ─────────────
  function updateScales(scrollLeft: number) {
    // Distance of item j from center = |scrollLeft - j * SNAP|
    // (derived from SIDE_PAD = window.innerWidth/2 - FRAME_W/2 cancelling out)
    itemRefs.current.forEach((el, j) => {
      if (!el) return
      const dist = Math.abs(scrollLeft - j * SNAP)   // in px
      const t    = dist / SNAP                         // in SNAP units

      let scale: number
      let opacity: number

      if (t <= 0.5) {
        scale   = lerp(S_CTR, S_ADJ, t * 2)
        opacity = lerp(1,     0.65,   t * 2)
      } else if (t <= 1.5) {
        scale   = lerp(S_ADJ, S_FAR, t - 0.5)
        opacity = lerp(0.65,  0.40,  t - 0.5)
      } else {
        scale   = S_FAR
        opacity = 0.40
      }

      el.style.transform = `scale(${scale.toFixed(3)})`
      el.style.opacity   = `${opacity.toFixed(3)}`
    })
  }

  // ── Infinite-loop teleport (fires after scroll stops) ────────────────────
  function checkLoop() {
    const el = containerRef.current
    if (!el) return
    const snapIdx = Math.round(el.scrollLeft / SNAP)
    if (snapIdx < ringSize) {
      el.scrollLeft += ringSize * SNAP
      updateScales(el.scrollLeft)
    } else if (snapIdx >= ringSize * 2) {
      el.scrollLeft -= ringSize * SNAP
      updateScales(el.scrollLeft)
    }
  }

  // ── Initial scroll to middle copy ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const timer = setTimeout(() => {
      el.scrollLeft = middleStart * SNAP
      updateScales(el.scrollLeft)
    }, 30)
    return () => clearTimeout(timer)
  }, [middleStart])

  // Re-run scales whenever photos change
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    updateScales(el.scrollLeft)
  }, [photos])

  // ── Scroll handler ────────────────────────────────────────────────────────
  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    updateScales(el.scrollLeft)

    // Debounced loop-check (fires when scroll settles)
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = setTimeout(checkLoop, 80)
  }

  // ── Tap handler ───────────────────────────────────────────────────────────
  function handleTap(virtualIdx: number) {
    const rIdx = virtualIdx % ringSize
    const photo = ring[rIdx]
    if (!photo) {
      if (isOwner) onReplaceRequest?.(rIdx)
      return
    }
    if (isOwner) {
      setMenuSlot(rIdx)
    } else {
      onOpenPhoto?.(rIdx)
    }
  }

  // Side padding for centering: calc(50vw - FRAME_W/2)
  const SIDE_PAD_CSS = `calc(50vw - ${FRAME_W / 2}px)`

  return (
    <div style={{ position: 'relative', background: TRACK_BG }}>
      <SprocketEdge />

      <div
        ref={containerRef}
        className="no-scrollbar"
        onScroll={handleScroll}
        style={{
          height: 96,
          overflowX: 'scroll',
          overflowY: 'hidden',
          background: TRACK_BG,
          display: 'flex',
          alignItems: 'center',
          gap: GAP,
          paddingLeft: SIDE_PAD_CSS,
          paddingRight: SIDE_PAD_CSS,
          // @ts-ignore – vendor prefix
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          // scroll-padding shifts the snap target to account for content padding
          scrollPaddingLeft: SIDE_PAD_CSS,
          position: 'relative',
          boxSizing: 'content-box',
        }}
      >
        {virtualData.map((photo, i) => (
          <div
            key={i}
            ref={el => { itemRefs.current[i] = el }}
            onClick={() => handleTap(i)}
            style={{
              width: FRAME_W,
              height: FRAME_H,
              borderRadius: 8,
              border: `1px solid ${FRAME_BDR}`,
              overflow: 'hidden',
              background: photo ? TRACK_BG : 'rgba(107,46,12,0.28)',
              flexShrink: 0,
              cursor: (isOwner || photo) ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // @ts-ignore
              scrollSnapAlign: 'start',
              willChange: 'transform',
            }}
          >
            {photo ? (
              <img
                src={photo}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : isOwner ? (
              <span style={{ color: AMBER_MID, fontSize: 24, lineHeight: 1 }}>+</span>
            ) : null}
          </div>
        ))}

        {/* Edge fade overlays */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to right, ${TRACK_BG}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: `linear-gradient(to left, ${TRACK_BG}, transparent)`, pointerEvents: 'none', zIndex: 2 }} />
      </div>

      <SprocketEdge />

      {/* Owner tap menu */}
      {menuSlot !== null && (
        <>
          <div
            onClick={() => setMenuSlot(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 15 + 6,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              background: '#1A1208',
              border: '1px solid #2E1A0A',
              borderRadius: 10,
              overflow: 'hidden',
              minWidth: 160,
              boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
            }}
          >
            <button
              onClick={() => { onOpenPhoto?.(menuSlot); setMenuSlot(null) }}
              style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', textAlign: 'left', color: '#F0E8D8', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #2E1A0A' }}
            >{t('filmHeader.open')}</button>
            <button
              onClick={() => { onReplaceRequest?.(menuSlot); setMenuSlot(null) }}
              style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', textAlign: 'left', color: '#F0E8D8', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #2E1A0A' }}
            >{t('filmHeader.replace')}</button>
            <button
              onClick={() => { onRemoveRequest?.(menuSlot); setMenuSlot(null) }}
              style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', textAlign: 'left', color: '#e05a5a', fontSize: 14, cursor: 'pointer' }}
            >{t('filmHeader.remove')}</button>
          </div>
        </>
      )}
    </div>
  )
}
