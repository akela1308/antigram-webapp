import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
  const { tracks, currentIndex, isPlaying, isLoading, toggle, next, prev, play, pause } = usePlayer()
  const [mode, setMode] = useState<'idle' | 'active'>('idle')

  const currentTrack = tracks[currentIndex]

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
        type="button"
        onClick={handleStart}
        aria-label="Включить музыку"
        style={idleButtonStyle}
      >
        <img src={PLAYER_ASSETS.musicOn} alt="" style={musicIconStyle} />
      </button>
    )
  }

  return (
    <div style={pillStyle}>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Закрыть плеер"
        style={closeButtonStyle}
      >
        ✕
      </button>

      <div style={controlsStyle}>
        <button type="button" onClick={prev} aria-label="Предыдущий трек" style={controlButtonStyle}>
          <img src={PLAYER_ASSETS.prev} alt="" style={controlIconStyle} />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Пауза' : 'Играть'}
          disabled={isLoading}
          style={{ ...controlButtonStyle, opacity: isLoading ? 0.55 : 1 }}
        >
          <img
            src={isPlaying ? PLAYER_ASSETS.pause : PLAYER_ASSETS.play}
            alt=""
            style={centerIconStyle}
          />
        </button>

        <button type="button" onClick={next} aria-label="Следующий трек" style={controlButtonStyle}>
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
