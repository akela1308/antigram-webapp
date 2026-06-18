import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

// ── Film presets (CSS filter–based LUT simulation) ──────────────────────────

interface FilmPreset {
  id: string
  name: string
  filter: string
}

const FILM_PRESETS: FilmPreset[] = [
  { id: 'none',        name: '∅',          filter: 'none' },
  { id: 'kodak',       name: 'Kodak',      filter: 'contrast(1.06) saturate(1.2) brightness(1.02) sepia(0.08) hue-rotate(-2deg)' },
  { id: 'fuji',        name: 'Fuji',       filter: 'contrast(1.1) saturate(0.88) hue-rotate(-8deg) brightness(0.97)' },
  { id: 'agfa',        name: 'Agfa',       filter: 'contrast(1.1) saturate(1.28) sepia(0.14) hue-rotate(6deg)' },
  { id: 'warm',        name: 'Warm',       filter: 'contrast(1.04) saturate(1.15) sepia(0.3) brightness(1.04)' },
  { id: 'cold',        name: 'Cold',       filter: 'contrast(1.12) saturate(0.72) hue-rotate(14deg) brightness(0.96)' },
  { id: 'bleach',      name: 'Bleach',     filter: 'contrast(1.38) saturate(0.62) brightness(0.92)' },
  { id: 'slide',       name: 'Slide',      filter: 'contrast(1.22) saturate(1.38) brightness(0.95) hue-rotate(-4deg)' },
  { id: 'technicolor', name: 'Technicolor',filter: 'contrast(1.16) saturate(1.48) hue-rotate(-9deg) brightness(0.96)' },
  { id: 'bw',          name: 'B&W',        filter: 'grayscale(1) contrast(1.18) brightness(0.93)' },
]

// ── Main component ────────────────────────────────────────────────────────────

type Phase = 'viewfinder' | 'preview' | 'uploading' | 'success'

export function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [phase, setPhase]               = useState<Phase>('viewfinder')
  const [facing, setFacing]             = useState<'user' | 'environment'>('environment')
  const [flash, setFlash]               = useState(false)
  const [preset, setPreset]             = useState<FilmPreset>(FILM_PRESETS[0])
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [photoBlob, setPhotoBlob]       = useState<Blob | null>(null)
  const [caption, setCaption]           = useState('')
  const [mood, setMood]                 = useState<ReactionType | null>(null)
  const [camError, setCamError]         = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  // ── Camera lifecycle ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width:  { ideal: 1080 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch {
      setCamError('Нет доступа к камере')
    }
  }, [facing])

  useEffect(() => {
    if (phase === 'viewfinder') startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [phase, startCamera])

  // ── Capture ─────────────────────────────────────────────────────────────────

  function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    if (!size) return

    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Apply CSS filter to canvas if preset selected
    if (preset.filter !== 'none') ctx.filter = preset.filter

    // Square crop from center
    const ox = (video.videoWidth  - size) / 2
    const oy = (video.videoHeight - size) / 2
    ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size)

    canvas.toBlob(blob => {
      if (!blob) return
      setPhotoBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      streamRef.current?.getTracks().forEach(t => t.stop())
      setPhase('preview')
    }, 'image/jpeg', 0.92)
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function publish() {
    if (!photoBlob || !user) return
    setPhase('uploading')
    setError(null)
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('moments')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' })
      if (upErr) throw new Error(upErr.message)

      const { data: { publicUrl } } = supabase.storage.from('moments').getPublicUrl(fileName)
      const { error: insErr } = await supabase.from('moments').insert({
        user_id:  user.id,
        photo_url: publicUrl,
        caption:   caption.trim() || null,
        mood:      mood ?? null,
        is_public: true,
      })
      if (insErr) throw new Error(insErr.message)

      setPhase('success')
      setTimeout(() => navigate('/'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при публикации')
      setPhase('preview')
    }
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPhotoBlob(null)
    setCaption('')
    setMood(null)
    setPhase('viewfinder')
  }

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={S.root}>
        <div style={S.centered}>
          <span style={{ fontSize: 48 }}>📷</span>
          <p style={{ color: '#666', margin: 0 }}>Войдите, чтобы снимать</p>
          <button onClick={() => navigate('/auth')} style={S.amberBtn}>Войти</button>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div style={{ ...S.root, ...S.centered }}>
        <span style={{ fontSize: 56 }}>🎞</span>
        <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Опубликовано!</p>
        <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Момент появится в ленте</p>
      </div>
    )
  }

  // ── PREVIEW phase ─────────────────────────────────────────────────────────

  if (phase === 'preview' || phase === 'uploading') {
    return (
      <div style={{ ...S.root, overflowY: 'auto', paddingTop: 'var(--tg-top, 0px)' }}>
        {/* Film strip top */}
        <FilmStripBar />

        {/* Preview image */}
        <img
          src={previewUrl ?? ''}
          alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
        />

        {/* Preset badge */}
        {preset.id !== 'none' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 5,
              background: '#2E2218', border: '1px solid var(--amber)',
            }} />
            <span style={{ color: 'var(--amber)', fontSize: 13 }}>{preset.name}</span>
          </div>
        )}

        {/* Атмосфера */}
        <div style={{ padding: '12px 16px 4px' }}>
          <p style={S.sectionLabel}>✦ Атмосфера</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EMOTIONS.map(e => {
              const active = mood === e.type
              return (
                <button
                  key={e.type}
                  onClick={() => setMood(active ? null : e.type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 13px', borderRadius: 20,
                    border: active ? 'none' : '1px solid #2E2218',
                    background: active ? 'var(--amber)' : '#1A1208',
                    color: active ? '#140E0A' : '#666',
                    fontSize: 14, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  }}
                >
                  <span>{e.emoji}</span><span>{e.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Caption */}
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Добавь подпись..."
          rows={3}
          maxLength={300}
          style={{
            margin: '8px 16px 0',
            width: 'calc(100% - 32px)',
            borderRadius: 12, padding: '12px 14px',
            resize: 'none', fontSize: 14, outline: 'none',
            background: '#1A1208', color: '#fff',
            border: '1px solid #2E2218', fontFamily: 'inherit',
          }}
        />

        {error && <p style={{ color: '#e05a5a', padding: '0 16px', textAlign: 'center' }}>{error}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, padding: '16px', paddingBottom: 'max(32px, calc(var(--tg-bottom,0px) + 16px))' }}>
          <button
            onClick={retake}
            disabled={phase === 'uploading'}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 30,
              border: '1px solid #2E2218', background: 'transparent',
              color: '#777', fontSize: 15, cursor: 'pointer',
            }}
          >
            Переснять
          </button>
          <button
            onClick={publish}
            disabled={phase === 'uploading'}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 30,
              background: 'var(--brown)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              border: 'none', opacity: phase === 'uploading' ? 0.6 : 1,
            }}
          >
            {phase === 'uploading' ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </div>
    )
  }

  // ── VIEWFINDER phase ──────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          paddingTop: 'var(--tg-top, 0px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <button onClick={() => navigate(-1)} style={S.topBtn}>✕</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFlash(f => !f)}
              style={{ ...S.topBtn, color: flash ? '#E8B84B' : '#fff' }}
            >
              ⚡
            </button>
            <button
              onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}
              style={S.topBtn}
            >
              ⇄
            </button>
          </div>
        </div>
      </div>

      {/* Viewfinder */}
      <div style={S.viewfinderArea}>
        {camError ? (
          <div style={{ ...S.viewfinderBox, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: '#666', fontSize: 14, textAlign: 'center', margin: 0 }}>{camError}</p>
            <button onClick={startCamera} style={{ ...S.amberBtn, padding: '10px 24px' }}>Разрешить</button>
          </div>
        ) : (
          <div style={S.viewfinderBox}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: preset.filter,
                transform: facing === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
            {/* Corner overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.07)',
              pointerEvents: 'none',
            }} />
          </div>
        )}
      </div>

      {/* Bottom panel: film strip + shutter */}
      <div style={S.bottomPanel}>
        {/* Film presets */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            padding: '0 16px', alignItems: 'center',
          }}
        >
          {FILM_PRESETS.map(p => {
            const active = p.id === preset.id
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p)}
                style={{
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: 4, borderRadius: 12,
                  border: `${active ? 2 : 1.5}px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  background: 'none', cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 8,
                    background: '#1A1208',
                    overflow: 'hidden', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {p.id === 'none' ? (
                    <span style={{ color: active ? 'var(--amber)' : '#555', fontSize: 22 }}>∅</span>
                  ) : (
                    <span style={{ color: active ? 'var(--amber)' : '#555', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textAlign: 'center', padding: '0 4px', lineHeight: 1.3 }}>
                      {p.name}
                    </span>
                  )}
                </div>
                <span style={{ color: active ? 'var(--amber)' : '#555', fontSize: 10 }}>
                  {p.name.split(' ')[0]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Shutter */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 'max(36px, calc(var(--tg-bottom,0px) + 24px))' }}>
          <button onClick={capture} style={S.shutter}>
            <div style={S.shutterInner}>
              <div style={S.shutterGlow} />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Decorative film strip bar ────────────────────────────────────────────────

function FilmStripBar() {
  return (
    <div style={{ background: 'var(--film-track)' }}>
      <div style={{
        height: 11, background: 'var(--film-amber)',
        display: 'flex', alignItems: 'center',
        padding: '0 4px', gap: 4, overflow: 'hidden',
      }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{ width: 10, height: 8, borderRadius: 2, background: 'var(--film-hole)', flexShrink: 0 }} />
        ))}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100dvh',
    background: '#0D0D0D',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  viewfinderArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
  },
  viewfinderBox: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 20,
    overflow: 'hidden',
    background: '#1A1208',
    position: 'relative',
  },
  bottomPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    paddingTop: 12,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    color: '#fff',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    background: '#2E1A0A',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(46,26,10,0.6)',
  },
  shutterInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    background: '#C4A882',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shutterGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#D4B99A',
    opacity: 0.45,
  },
  amberBtn: {
    padding: '12px 32px',
    borderRadius: 30,
    background: 'var(--amber)',
    color: '#140E0A',
    border: 'none',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  sectionLabel: {
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    margin: '0 0 10px',
  },
}
