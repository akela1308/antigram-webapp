import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { usePlayer } from '../contexts/PlayerContext'

const PLAYER_ASSETS = {
  play: `${import.meta.env.BASE_URL}player/play.png`,
  pause: `${import.meta.env.BASE_URL}player/pause.png`,
  prev: `${import.meta.env.BASE_URL}player/prev.png`,
  next: `${import.meta.env.BASE_URL}player/next.png`,
  musicOn: `${import.meta.env.BASE_URL}player/music_on.png`,
}

const fixedRight = 'max(14px, calc((100vw - 480px) / 2 + 14px))'
const fixedBottom = 'calc(max(20px, env(safe-area-inset-bottom, 20px)) + 75px)'
const PLAYER_POSITION_KEY = 'antigram-mini-player-position'
const PLAYER_VIEWPORT_MARGIN = 8
const DRAG_THRESHOLD = 6

type PlayerPosition = { x: number; y: number }
type TelegramWebApp = {
  CloudStorage?: {
    getItem?: (key: string, callback: (error: string | null, value: string | null) => void) => void
    setItem?: (key: string, value: string, callback?: (error: string | null, success?: boolean) => void) => void
  }
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
}

function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null
  } catch {
    return null
  }
}

function parsePosition(value: string | null): PlayerPosition | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<PlayerPosition>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return parsed as PlayerPosition
  } catch {
    return null
  }
}

function getStoredPosition(): PlayerPosition | null {
  if (typeof window === 'undefined') return null

  try {
    return parsePosition(window.localStorage.getItem(PLAYER_POSITION_KEY))
  } catch {
    return null
  }
}

function storePosition(position: PlayerPosition) {
  const serialized = JSON.stringify(position)

  try {
    window.localStorage.setItem(PLAYER_POSITION_KEY, serialized)
  } catch {
    // Position persistence is a comfort feature; dragging should keep working without it.
  }

  try {
    getTelegramWebApp()?.CloudStorage?.setItem?.(PLAYER_POSITION_KEY, serialized)
  } catch {
    // CloudStorage is available only inside supported Telegram clients.
  }
}

function getCloudStoredPosition(): Promise<PlayerPosition | null> {
  const storage = getTelegramWebApp()?.CloudStorage
  if (!storage?.getItem) return Promise.resolve(null)

  return new Promise(resolve => {
    try {
      storage.getItem?.(PLAYER_POSITION_KEY, (_error, value) => {
        resolve(parsePosition(value))
      })
    } catch {
      resolve(null)
    }
  })
}

function setTelegramVerticalSwipes(enabled: boolean) {
  try {
    const tg = getTelegramWebApp()
    if (enabled) tg?.enableVerticalSwipes?.()
    else tg?.disableVerticalSwipes?.()
  } catch {
    // Older Telegram clients simply do not support this API.
  }
}

function getViewportSize() {
  const viewport = window.visualViewport
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  }
}

function getDefaultPosition(element: HTMLElement): PlayerPosition {
  const rect = element.getBoundingClientRect()
  const viewport = getViewportSize()
  const rightMargin = Math.max(14, (viewport.width - 480) / 2 + 14)
  const bottomMargin = 95

  return {
    x: viewport.width - rect.width - rightMargin,
    y: viewport.height - rect.height - bottomMargin,
  }
}

function clampPosition(position: PlayerPosition, element: HTMLElement): PlayerPosition {
  const rect = element.getBoundingClientRect()
  const viewport = getViewportSize()
  const maxX = Math.max(PLAYER_VIEWPORT_MARGIN, viewport.width - rect.width - PLAYER_VIEWPORT_MARGIN)
  const maxY = Math.max(PLAYER_VIEWPORT_MARGIN, viewport.height - rect.height - PLAYER_VIEWPORT_MARGIN)

  return {
    x: Math.min(Math.max(position.x, PLAYER_VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(position.y, PLAYER_VIEWPORT_MARGIN), maxY),
  }
}

function Marquee({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [textWidth, setTextWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      setTextWidth(textRef.current?.scrollWidth ?? 0)
      setContainerWidth(containerRef.current?.clientWidth ?? 0)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [text])

  const shouldScroll = textWidth > containerWidth && containerWidth > 0
  const distance = textWidth + 32
  const duration = Math.max(3, distance / 50)
  const marqueeStyle = {
    '--antigram-mini-player-marquee-distance': `-${distance}px`,
    animation: shouldScroll
      ? `antigram-mini-player-marquee ${duration}s linear 1s infinite`
      : undefined,
  } as CSSProperties

  return (
    <div
      ref={containerRef}
      style={{
        overflow: 'hidden',
        height: 16,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', whiteSpace: 'nowrap', ...marqueeStyle }}>
        <span ref={textRef} style={trackNameStyle}>{text}</span>
        {shouldScroll && <span style={{ ...trackNameStyle, paddingLeft: 32 }}>{text}</span>}
      </div>
    </div>
  )
}

export function MiniPlayer() {
  const { t } = useLanguage()
  const { tracks, currentIndex, isPlaying, isLoading, toggle, next, prev, play, pause } = usePlayer()
  const [mode, setMode] = useState<'idle' | 'active'>('idle')
  const [position, setPosition] = useState<PlayerPosition | null>(() => getStoredPosition())
  const [isDragging, setIsDragging] = useState(false)
  const playerRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)

  const currentTrack = tracks[currentIndex]

  useLayoutEffect(() => {
    const element = playerRef.current
    if (!element) return

    const basePosition = position ?? getDefaultPosition(element)
    const nextPosition = clampPosition(basePosition, element)
    setPosition(nextPosition)
  }, [mode])

  useEffect(() => {
    let cancelled = false

    getCloudStoredPosition().then(stored => {
      if (cancelled || !stored) return
      const element = playerRef.current
      if (!element) return

      const nextPosition = clampPosition(stored, element)
      setPosition(nextPosition)
      try {
        window.localStorage.setItem(PLAYER_POSITION_KEY, JSON.stringify(nextPosition))
      } catch {
        // Local mirror is optional; CloudStorage remains the source of truth here.
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      setTelegramVerticalSwipes(true)
    }
  }, [])

  useEffect(() => {
    const keepInBounds = () => {
      const element = playerRef.current
      if (!element) return

      setPosition(current => {
        const nextPosition = clampPosition(current ?? getDefaultPosition(element), element)
        storePosition(nextPosition)
        return nextPosition
      })
    }

    window.addEventListener('resize', keepInBounds)
    window.visualViewport?.addEventListener('resize', keepInBounds)
    return () => {
      window.removeEventListener('resize', keepInBounds)
      window.visualViewport?.removeEventListener('resize', keepInBounds)
    }
  }, [])

  function updatePosition(nextPosition: PlayerPosition) {
    const element = playerRef.current
    if (!element) return

    const clamped = clampPosition(nextPosition, element)
    setPosition(clamped)
    storePosition(clamped)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return

    const element = playerRef.current
    if (!element) return

    const origin = position ?? clampPosition(getDefaultPosition(element), element)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }

    setPosition(origin)
    setTelegramVerticalSwipes(false)
    element.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const hasMoved = Math.hypot(dx, dy) > DRAG_THRESHOLD

    if (hasMoved) {
      drag.moved = true
      suppressClickRef.current = true
      setIsDragging(true)
      updatePosition({ x: drag.originX + dx, y: drag.originY + dy })
    }
  }

  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    playerRef.current?.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
    setIsDragging(false)
    setTelegramVerticalSwipes(true)

    if (drag.moved) {
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
  }

  function handleClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  const positionStyle: CSSProperties = position
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : {}

  async function handleStart() {
    setMode('active')
    await play()
  }

  async function handleClose() {
    await pause()
    setMode('idle')
  }

  if (mode === 'idle') {
    return (
      <button
        ref={node => { playerRef.current = node }}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        onClick={handleStart}
        aria-label={t('music.enable')}
        style={{
          ...idleButtonStyle,
          ...positionStyle,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <img src={PLAYER_ASSETS.musicOn} alt="" style={musicIconStyle} />
      </button>
    )
  }

  return (
    <div
      ref={node => { playerRef.current = node }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClickCapture={handleClickCapture}
      style={{
        ...pillStyle,
        ...positionStyle,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label={t('music.close')}
        style={closeButtonStyle}
      >
        ✕
      </button>

      <div style={controlsStyle}>
        <button type="button" onClick={prev} aria-label={t('music.previous')} style={controlButtonStyle}>
          <img src={PLAYER_ASSETS.prev} alt="" style={controlIconStyle} />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? t('music.pause') : t('music.play')}
          disabled={isLoading}
          style={{ ...controlButtonStyle, opacity: isLoading ? 0.55 : 1 }}
        >
          <img
            src={isPlaying ? PLAYER_ASSETS.pause : PLAYER_ASSETS.play}
            alt=""
            style={centerIconStyle}
          />
        </button>

        <button type="button" onClick={next} aria-label={t('music.next')} style={controlButtonStyle}>
          <img src={PLAYER_ASSETS.next} alt="" style={controlIconStyle} />
        </button>
      </div>

      <Marquee text={currentTrack?.name ?? ''} />
    </div>
  )
}

const idleButtonStyle: CSSProperties = {
  position: 'fixed',
  bottom: fixedBottom,
  right: fixedRight,
  zIndex: 60,
  width: 46,
  height: 46,
  borderRadius: 14,
  background: 'rgba(26,20,14,0.92)',
  border: '1px solid rgba(201,132,62,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
  WebkitTapHighlightColor: 'transparent',
}

const musicIconStyle: CSSProperties = {
  width: 20,
  height: 20,
  objectFit: 'contain',
  filter: 'sepia(1) saturate(3.2) hue-rotate(355deg) brightness(0.88)',
}

const pillStyle: CSSProperties = {
  position: 'fixed',
  bottom: fixedBottom,
  right: fixedRight,
  zIndex: 60,
  width: 160,
  borderRadius: 16,
  background: 'rgba(20,16,12,0.96)',
  padding: '10px 12px',
  border: '1px solid rgba(201,132,62,0.2)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  WebkitTapHighlightColor: 'transparent',
}

const closeButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 8,
  zIndex: 1,
  border: 'none',
  background: 'transparent',
  color: 'rgba(255,255,255,0.35)',
  fontSize: 10,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 4,
}

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 2,
  marginBottom: 6,
}

const controlButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
}

const controlIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  objectFit: 'contain',
  opacity: 0.65,
}

const centerIconStyle: CSSProperties = {
  width: 20,
  height: 20,
  objectFit: 'contain',
  opacity: 1,
}

const trackNameStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  letterSpacing: 0.5,
  lineHeight: '16px',
}
