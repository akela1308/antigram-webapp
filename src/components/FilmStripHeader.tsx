import { useState, useRef, useEffect } from 'react'

interface FilmStripHeaderProps {
  photos: (string | null)[]  // exactly 5 slots
  isOwner?: boolean
  onReplaceRequest?: (slotIndex: number) => void
  onOpenPhoto?: (slotIndex: number) => void
  onRemoveRequest?: (slotIndex: number) => void
}

const SPROCKET_COUNT = 18

function SprocketEdge() {
  return (
    <div style={{
      height: 14,
      background: '#A05C18',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: '0 6px',
      overflow: 'hidden',
    }}>
      {Array.from({ length: SPROCKET_COUNT }).map((_, i) => (
        <div key={i} style={{
          width: 12, height: 10, borderRadius: 2,
          background: '#3A1406',
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

export function FilmStripHeader({ photos, isOwner, onReplaceRequest, onOpenPhoto, onRemoveRequest }: FilmStripHeaderProps) {
  const [menuSlot, setMenuSlot] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside tap
  useEffect(() => {
    if (menuSlot === null) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuSlot(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuSlot])

  function handleFrameTap(i: number) {
    const hasPhoto = !!photos[i]
    if (!isOwner) {
      if (hasPhoto) onOpenPhoto?.(i)
      return
    }
    if (!hasPhoto) {
      onReplaceRequest?.(i)
    } else {
      setMenuSlot(prev => prev === i ? null : i)
    }
  }

  return (
    <div style={{ position: 'relative', background: '#0E0804' }}>
      <SprocketEdge />

      {/* Track */}
      <div
        className="no-scrollbar"
        style={{
          height: 96,
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          padding: '0 16px',
          gap: 10,
          background: '#0E0804',
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const photo = photos[i] ?? null
          return (
            <div
              key={i}
              onClick={() => handleFrameTap(i)}
              style={{
                width: 72, height: 72,
                borderRadius: 8,
                border: `1px solid ${menuSlot === i ? '#D4891A' : '#6B3A12'}`,
                overflow: 'hidden',
                background: photo ? '#0E0804' : 'rgba(107,46,12,0.28)',
                flexShrink: 0,
                cursor: isOwner || photo ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : isOwner ? (
                <span style={{ color: '#D4891A', fontSize: 24, lineHeight: 1 }}>+</span>
              ) : null}
            </div>
          )
        })}
      </div>

      <SprocketEdge />

      {/* Inline mini-menu */}
      {menuSlot !== null && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: 14 + 96 + 14 + 4,
            left: 16 + menuSlot * (72 + 10),
            zIndex: 200,
            background: '#1A1208',
            border: '1px solid #2E1A0A',
            borderRadius: 10,
            overflow: 'hidden',
            minWidth: 140,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          <button
            onClick={() => { onOpenPhoto?.(menuSlot); setMenuSlot(null) }}
            style={{
              display: 'block', width: '100%', padding: '11px 16px',
              background: 'none', border: 'none', textAlign: 'left',
              color: '#F0E8D8', fontSize: 14, cursor: 'pointer',
              borderBottom: '1px solid #2E1A0A',
            }}
          >
            Открыть
          </button>
          <button
            onClick={() => { onReplaceRequest?.(menuSlot); setMenuSlot(null) }}
            style={{
              display: 'block', width: '100%', padding: '11px 16px',
              background: 'none', border: 'none', textAlign: 'left',
              color: '#F0E8D8', fontSize: 14, cursor: 'pointer',
              borderBottom: '1px solid #2E1A0A',
            }}
          >
            Заменить
          </button>
          <button
            onClick={() => { onRemoveRequest?.(menuSlot); setMenuSlot(null) }}
            style={{
              display: 'block', width: '100%', padding: '11px 16px',
              background: 'none', border: 'none', textAlign: 'left',
              color: '#e05a5a', fontSize: 14, cursor: 'pointer',
            }}
          >
            Убрать
          </button>
        </div>
      )}
    </div>
  )
}
