import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type GrainConfig = {
  intensity: number
  size:      number
  shape:     'round' | 'tgrain'
  r: number
  g: number
  b: number
}

type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'
type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'

interface FilmPreset {
  id:        string
  name:      string
  filter:    string
  grain:     GrainConfig
  algoType?: AlgoType
}

// ── Film presets ──────────────────────────────────────────────────────────────

const FILM_PRESETS: FilmPreset[] = [
  {
    id: 'none', name: '∅', filter: 'none',
    grain: { intensity: 0.004, size: 0.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'kodak', name: 'Kodak Portra', filter: 'contrast(1.06) saturate(1.2) brightness(1.02) sepia(0.08) hue-rotate(-2deg)',
    grain: { intensity: 0.010, size: 1.2, shape: 'tgrain', r: 1.0, g: 0.90, b: 0.65 },
  },
  {
    id: 'fuji', name: 'Fuji Superia', filter: 'contrast(1.1) saturate(0.88) hue-rotate(-8deg) brightness(0.97)',
    grain: { intensity: 0.007, size: 1.0, shape: 'round', r: 0.70, g: 1.0, b: 0.85 },
  },
  {
    id: 'agfa', name: 'Agfa Vista', filter: 'contrast(1.1) saturate(1.28) sepia(0.14) hue-rotate(6deg)',
    grain: { intensity: 0.012, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.65 },
  },
  {
    id: 'warm', name: 'Warm', filter: 'contrast(1.04) saturate(1.15) sepia(0.3) brightness(1.04)',
    grain: { intensity: 0.009, size: 1.0, shape: 'round', r: 1.0, g: 0.80, b: 0.50 },
  },
  {
    id: 'cold', name: 'Cold', filter: 'contrast(1.12) saturate(0.72) hue-rotate(14deg) brightness(0.96)',
    grain: { intensity: 0.008, size: 1.0, shape: 'round', r: 0.55, g: 0.80, b: 1.0 },
  },
  {
    id: 'bleach', name: 'Bleach Bypass', filter: 'contrast(1.38) saturate(0.62) brightness(0.92)',
    grain: { intensity: 0.011, size: 1.3, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'slide', name: 'Slide', filter: 'contrast(1.22) saturate(1.38) brightness(0.95) hue-rotate(-4deg)',
    grain: { intensity: 0.005, size: 0.8, shape: 'round', r: 1.0, g: 0.90, b: 0.80 },
  },
  {
    id: 'technicolor', name: 'Technicolor', filter: 'contrast(1.16) saturate(1.48) hue-rotate(-9deg) brightness(0.96)',
    grain: { intensity: 0.014, size: 1.7, shape: 'round', r: 1.0, g: 0.95, b: 0.45 },
  },
  {
    id: 'hc_bw', name: 'HC B&W', filter: 'grayscale(1) contrast(1.18) brightness(0.93)',
    grain: { intensity: 0.018, size: 2.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'orthochrom', name: 'Orthochrom', filter: 'none',
    grain: { intensity: 0.022, size: 1.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    algoType: 'orthochrom',
  },
  {
    id: 'ultramax', name: 'Ultramax', filter: 'none',
    grain: { intensity: 0.010, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.60 },
    algoType: 'ultramax',
  },
  {
    id: 'vision_t', name: 'Vision T', filter: 'none',
    grain: { intensity: 0.009, size: 1.5, shape: 'tgrain', r: 0.65, g: 0.80, b: 1.0 },
    algoType: 'vision_t',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function triangleRandom(): number {
  return (Math.random() + Math.random()) / 2
}

// ── Grain ─────────────────────────────────────────────────────────────────────

function applyGrain(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, grain: GrainConfig): void {
  const W = canvas.width
  const H = canvas.height

  if (grain.size > 1.0) {
    // Generate noise on a smaller canvas, then upscale to create visible clusters
    const sw = Math.max(1, Math.floor(W / grain.size))
    const sh = Math.max(1, Math.floor(H / grain.size))
    const small = new OffscreenCanvas(sw, sh)
    const smallCtx = small.getContext('2d', { willReadFrequently: true })!

    // Draw current image content scaled down
    smallCtx.drawImage(canvas, 0, 0, sw, sh)
    const smallData = smallCtx.getImageData(0, 0, sw, sh)
    const sd = smallData.data

    for (let i = 0; i < sd.length; i += 4) {
      const noise = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      const noiseVal = noise * grain.intensity * 220
      sd[i]     = clamp(sd[i]     + noiseVal * grain.r, 0, 255)
      sd[i + 1] = clamp(sd[i + 1] + noiseVal * grain.g, 0, 255)
      sd[i + 2] = clamp(sd[i + 2] + noiseVal * grain.b, 0, 255)
    }

    smallCtx.putImageData(smallData, 0, 0)
    // Upscale back — nearest-neighbour gives visible clustering
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, W, H)
    ctx.imageSmoothingEnabled = true
  } else {
    const imageData = ctx.getImageData(0, 0, W, H)
    const d = imageData.data

    for (let i = 0; i < d.length; i += 4) {
      const noise = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      const noiseVal = noise * grain.intensity * 220
      d[i]     = clamp(d[i]     + noiseVal * grain.r, 0, 255)
      d[i + 1] = clamp(d[i + 1] + noiseVal * grain.g, 0, 255)
      d[i + 2] = clamp(d[i + 2] + noiseVal * grain.b, 0, 255)
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

// ── Algorithmic presets ───────────────────────────────────────────────────────

function applyAlgo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, algoType: AlgoType): void {
  const W = canvas.width
  const H = canvas.height
  const imageData = ctx.getImageData(0, 0, W, H)
  const d = imageData.data

  if (algoType === 'orthochrom') {
    for (let i = 0; i < d.length; i += 4) {
      let lum = d[i] * 0.90 + d[i + 1] * 0.06 + d[i + 2] * 0.04
      lum = clamp((lum - 128) * 1.55 + 128, 0, 255)
      d[i] = d[i + 1] = d[i + 2] = lum
    }
  } else if (algoType === 'ultramax') {
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 1.08 + 12, 0, 255)
      let g = clamp(d[i + 1] * 1.02,      0, 255)
      let b = clamp(d[i + 2] * 0.85 - 6,  0, 255)
      r = clamp((r - 128) * 1.10 + 128, 0, 255)
      g = clamp((g - 128) * 1.08 + 128, 0, 255)
      b = clamp((b - 128) * 1.10 + 128, 0, 255)
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  } else if (algoType === 'vision_t') {
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 0.88 - 8,  0, 255)
      let g = clamp(d[i + 1] * 0.97,       0, 255)
      let b = clamp(d[i + 2] * 1.14 + 10, 0, 255)
      r = clamp((r - 128) * 0.95 + 128, 0, 255)
      g = clamp((g - 128) * 0.95 + 128, 0, 255)
      b = clamp((b - 128) * 0.95 + 128, 0, 255)
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Light leaks / flare ───────────────────────────────────────────────────────

function applyFlare(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, flareType: FlareType): void {
  if (flareType === 'none') return

  const W = canvas.width
  const H = canvas.height
  const off = new OffscreenCanvas(W, H)
  const oc = off.getContext('2d')!

  if (flareType === 'leak_warm') {
    const g1 = oc.createRadialGradient(0, 0, 0, 0, 0, W * 0.65)
    g1.addColorStop(0.0, 'rgba(200,140,60,0.55)')
    g1.addColorStop(0.5, 'rgba(180,100,30,0.20)')
    g1.addColorStop(1.0, 'rgba(0,0,0,0)')
    oc.fillStyle = g1
    oc.fillRect(0, 0, W, H)

    const g2 = oc.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, W * 0.45)
    g2.addColorStop(0.0, 'rgba(255,200,100,0.20)')
    g2.addColorStop(1.0, 'rgba(0,0,0,0)')
    oc.fillStyle = g2
    oc.fillRect(0, 0, W, H)
  } else if (flareType === 'leak_cool') {
    const g = oc.createRadialGradient(W, H, 0, W, H, W * 0.7)
    g.addColorStop(0.0, 'rgba(60,100,200,0.45)')
    g.addColorStop(0.4, 'rgba(40,80,180,0.15)')
    g.addColorStop(1.0, 'rgba(0,0,0,0)')
    oc.fillStyle = g
    oc.fillRect(0, 0, W, H)
  } else if (flareType === 'edge_burn') {
    const g = oc.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72)
    g.addColorStop(0.0, 'rgba(255,255,255,0)')
    g.addColorStop(1.0, 'rgba(30,20,15,0.75)')
    oc.fillStyle = g
    oc.fillRect(0, 0, W, H)
    // edge_burn uses multiply — draw directly with multiply blend
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(off, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    return
  } else if (flareType === 'streak') {
    const g1 = oc.createLinearGradient(0, H * 0.45, 0, H * 0.55)
    g1.addColorStop(0.0, 'rgba(0,0,0,0)')
    g1.addColorStop(0.5, 'rgba(210,180,130,0.18)')
    g1.addColorStop(1.0, 'rgba(0,0,0,0)')
    oc.fillStyle = g1
    oc.fillRect(0, 0, W, H)

    const g2 = oc.createLinearGradient(W * 0.2, 0, W * 0.3, 0)
    g2.addColorStop(0.0, 'rgba(255,230,180,0.08)')
    g2.addColorStop(1.0, 'rgba(0,0,0,0)')
    oc.fillStyle = g2
    oc.fillRect(0, 0, W, H)
  }

  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(off, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

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
  const [selectedFlare, setSelectedFlare] = useState<FlareType>('none')
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

  async function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    if (!size) return

    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    // 1. Bake CSS filter (LUT simulation)
    if (preset.filter !== 'none') ctx.filter = preset.filter
    const ox = (video.videoWidth  - size) / 2
    const oy = (video.videoHeight - size) / 2
    ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size)
    ctx.filter = 'none'

    // 2. Algorithmic preset (if set)
    if (preset.algoType) {
      applyAlgo(ctx, canvas, preset.algoType)
    }

    // 3. Film grain
    applyGrain(ctx, canvas, preset.grain)

    // 4. Light leak / flare (last)
    if (selectedFlare !== 'none') {
      applyFlare(ctx, canvas, selectedFlare)
    }

    // 5. Export
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
        user_id:   user.id,
        photo_url: publicUrl,
        caption:   caption.trim() || null,
        mood:      mood ?? null,
        visibility: 'public',
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

        {/* Preset badge + processing info */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 16px 4px', alignItems: 'center' }}>
          {preset.id !== 'none' && (
            <>
              <div style={{
                width: 24, height: 24, borderRadius: 5,
                background: '#2E2218', border: '1px solid var(--amber)',
              }} />
              <span style={{ color: 'var(--amber)', fontSize: 13 }}>{preset.name}</span>
              <span style={{ color: '#555', fontSize: 11 }}>
                · grain {Math.round(preset.grain.intensity * 1000)}
              </span>
            </>
          )}
          {selectedFlare !== 'none' && (
            <span style={{ color: '#555', fontSize: 11 }}>· {selectedFlare}</span>
          )}
        </div>

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

  const flareLabels: Record<FlareType, string> = {
    none: '∅', leak_warm: '🔥', leak_cool: '❄️', edge_burn: '◎', streak: '—',
  }

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
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.07)',
              pointerEvents: 'none',
            }} />
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={S.bottomPanel}>

        {/* Light leak selector */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', alignItems: 'center' }}>
          <span style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>СВЕТ</span>
          {(['none', 'leak_warm', 'leak_cool', 'edge_burn', 'streak'] as FlareType[]).map(f => {
            const active = selectedFlare === f
            return (
              <button
                key={f}
                onClick={() => setSelectedFlare(f)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  border: `${active ? 2 : 1}px solid ${active ? 'var(--amber)' : '#333'}`,
                  background: active ? 'rgba(196,168,130,0.15)' : 'transparent',
                  color: active ? 'var(--amber)' : '#555',
                  fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {flareLabels[f]}
              </button>
            )
          })}
        </div>

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
    gap: 16,
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
