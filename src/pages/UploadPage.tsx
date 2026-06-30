import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { EMOTIONS } from '../lib/types'
import { FILM_PRESETS } from '../lib/filmPresets'
import type { FilmPreset, AlgoType, GrainConfig, FlareType } from '../lib/filmPresets'
import type { ReactionType } from '../lib/types'
import { trackPhotoPosted, trackFilterApplied } from '../lib/analytics'
import { addReaction, getTodaysMomentCount, DAILY_FRAME_LIMIT } from '../lib/db'

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
    const sw = Math.max(1, Math.floor(W / grain.size))
    const sh = Math.max(1, Math.floor(H / grain.size))
    const small = new OffscreenCanvas(sw, sh)
    const smallCtx = small.getContext('2d', { willReadFrequently: true })!

    smallCtx.drawImage(canvas, 0, 0, sw, sh)
    const smallData = smallCtx.getImageData(0, 0, sw, sh)
    const sd = smallData.data

    for (let i = 0; i < sd.length; i += 4) {
      const noise = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      const noiseVal = noise * grain.intensity * 1000
      sd[i]     = clamp(sd[i]     + noiseVal * grain.r, 0, 255)
      sd[i + 1] = clamp(sd[i + 1] + noiseVal * grain.g, 0, 255)
      sd[i + 2] = clamp(sd[i + 2] + noiseVal * grain.b, 0, 255)
    }

    smallCtx.putImageData(smallData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, W, H)
    ctx.imageSmoothingEnabled = true
  } else {
    const imageData = ctx.getImageData(0, 0, W, H)
    const d = imageData.data

    for (let i = 0; i < d.length; i += 4) {
      const noise = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      const noiseVal = noise * grain.intensity * 1000
      d[i]     = clamp(d[i]     + noiseVal * grain.r, 0, 255)
      d[i + 1] = clamp(d[i + 1] + noiseVal * grain.g, 0, 255)
      d[i + 2] = clamp(d[i + 2] + noiseVal * grain.b, 0, 255)
    }

    ctx.putImageData(imageData, 0, 0)
  }
}

// ── CSS filter simulation (ctx.filter is unreliable in Telegram WebView) ─────
//
// Implements: brightness, contrast, saturate, grayscale, sepia, hue-rotate
// as pixel-level math identical to the CSS spec.

function applyFilter(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, filterStr: string): void {
  if (!filterStr || filterStr === 'none') return

  // Parse filter string once; precompute hue-rotate matrix
  type Op = { t: string; v: number; mx?: number[] }
  const ops: Op[] = []
  const re = /([\w-]+)\(\s*([^)]+?)\s*\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(filterStr)) !== null) {
    const t = m[1], v = parseFloat(m[2])
    if (t === 'hue-rotate') {
      const rad = v * Math.PI / 180
      const c = Math.cos(rad), s = Math.sin(rad)
      ops.push({ t, v, mx: [
        0.213 + c*0.787 - s*0.213, 0.715 - c*0.715 - s*0.715, 0.072 - c*0.072 + s*0.928,
        0.213 - c*0.213 + s*0.143, 0.715 + c*0.285 + s*0.140, 0.072 - c*0.072 - s*0.283,
        0.213 - c*0.213 - s*0.787, 0.715 - c*0.715 + s*0.715, 0.072 + c*0.928 + s*0.072,
      ]})
    } else {
      ops.push({ t, v })
    }
  }
  if (ops.length === 0) return

  const { width: W, height: H } = canvas
  const imageData = ctx.getImageData(0, 0, W, H)
  const d = imageData.data

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255

    for (const op of ops) {
      const v = op.v
      if (op.t === 'brightness') {
        r *= v; g *= v; b *= v
      } else if (op.t === 'contrast') {
        r = (r - 0.5) * v + 0.5
        g = (g - 0.5) * v + 0.5
        b = (b - 0.5) * v + 0.5
      } else if (op.t === 'saturate') {
        const lum = 0.2126*r + 0.7152*g + 0.0722*b
        r = lum + (r - lum) * v; g = lum + (g - lum) * v; b = lum + (b - lum) * v
      } else if (op.t === 'grayscale') {
        const lum = 0.2126*r + 0.7152*g + 0.0722*b
        r += (lum - r) * v; g += (lum - g) * v; b += (lum - b) * v
      } else if (op.t === 'sepia') {
        const nr = r*0.393 + g*0.769 + b*0.189
        const ng = r*0.349 + g*0.686 + b*0.168
        const nb = r*0.272 + g*0.534 + b*0.131
        r += (nr - r) * v; g += (ng - g) * v; b += (nb - b) * v
      } else if (op.t === 'hue-rotate') {
        const e = op.mx!
        const nr = e[0]*r + e[1]*g + e[2]*b
        const ng = e[3]*r + e[4]*g + e[5]*b
        const nb = e[6]*r + e[7]*g + e[8]*b
        r = nr; g = ng; b = nb
      }
    }

    d[i]     = clamp(r * 255, 0, 255)
    d[i + 1] = clamp(g * 255, 0, 255)
    d[i + 2] = clamp(b * 255, 0, 255)
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Algorithmic presets ───────────────────────────────────────────────────────

function applyAlgo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, algoType: AlgoType): void {
  const W = canvas.width
  const H = canvas.height
  const imageData = ctx.getImageData(0, 0, W, H)
  const d = imageData.data

  if (algoType === 'orthochrom') {
    for (let i = 0; i < d.length; i += 4) {
      let lum = d[i] * 0.92 + d[i + 1] * 0.07 + d[i + 2] * 0.01
      lum = clamp((lum - 128) * 1.75 + 128, 0, 255)
      d[i] = d[i + 1] = d[i + 2] = lum
    }
  } else if (algoType === 'ultramax') {
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 1.18 + 20, 0, 255)
      let g = clamp(d[i + 1] * 1.04,      0, 255)
      let b = clamp(d[i + 2] * 0.72 - 12, 0, 255)
      r = clamp((r - 128) * 1.18 + 128, 0, 255)
      g = clamp((g - 128) * 1.12 + 128, 0, 255)
      b = clamp((b - 128) * 1.15 + 128, 0, 255)
      d[i] = r; d[i + 1] = g; d[i + 2] = b
    }
  } else if (algoType === 'vision_t') {
    for (let i = 0; i < d.length; i += 4) {
      let r = clamp(d[i]     * 0.76 - 16, 0, 255)
      let g = clamp(d[i + 1] * 0.96,      0, 255)
      let b = clamp(d[i + 2] * 1.28 + 18, 0, 255)
      r = clamp((r - 128) * 0.90 + 128, 0, 255)
      g = clamp((g - 128) * 0.90 + 128, 0, 255)
      b = clamp((b - 128) * 0.92 + 128, 0, 255)
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
type TelegramBackButton = {
  show?: () => void
  hide?: () => void
  onClick?: (handler: () => void) => void
  offClick?: (handler: () => void) => void
}
type TelegramWebApp = {
  BackButton?: TelegramBackButton
  HapticFeedback?: { impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void }
}

function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return ((window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp) ?? null
  } catch {
    return null
  }
}

export function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const captureLockRef = useRef(false)

  // Read film preset from router state (set by FilmPicker sheet in BottomNav)
  const initialPreset = (() => {
    const filmId = (location.state as { filmId?: string } | null)?.filmId
    return FILM_PRESETS.find(p => p.id === filmId) ?? FILM_PRESETS[1]
  })()

  const [phase, setPhase]               = useState<Phase>('viewfinder')
  const [facing, setFacing]             = useState<'user' | 'environment'>('environment')
  const [flash, setFlash]               = useState(false)
  const [preset, setPreset]             = useState<FilmPreset>(initialPreset)
  const [selectedFlare, setSelectedFlare] = useState<FlareType>('none')
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [photoBlob, setPhotoBlob]       = useState<Blob | null>(null)
  const [isCapturing, setIsCapturing]   = useState(false)
  const [caption, setCaption]           = useState('')
  const [mood, setMood]                 = useState<ReactionType | null>(null)
  const [customMoodEmoji, setCustomMoodEmoji] = useState('')
  const [customMoodLabel, setCustomMoodLabel] = useState('')
  const [showCustomMoodSheet, setShowCustomMoodSheet] = useState(false)
  const [draftEmoji, setDraftEmoji]     = useState('')
  const [draftLabel, setDraftLabel]     = useState('')
  const [camError, setCamError]         = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [todayCount, setTodayCount]     = useState<number | null>(null)
  const [limitMsg, setLimitMsg]         = useState(false)
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 720 : window.innerHeight,
  )

  const framesUsed      = todayCount ?? 0
  const framesRemaining = Math.max(0, DAILY_FRAME_LIMIT - framesUsed)
  const limitReached    = todayCount !== null && framesRemaining === 0
  const isCompactCamera = viewportHeight <= 700
  const isTinyCamera    = viewportHeight <= 600
  const cameraUi        = getCameraUi(isCompactCamera, isTinyCamera)

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight)
    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    window.visualViewport?.addEventListener('resize', updateViewportHeight)
    return () => {
      window.removeEventListener('resize', updateViewportHeight)
      window.visualViewport?.removeEventListener('resize', updateViewportHeight)
    }
  }, [])

  useEffect(() => {
    if (user) {
      getTodaysMomentCount(user.id).then(setTodayCount)
    }
  }, [user])

  useEffect(() => {
    if (!showCustomMoodSheet) return

    const tg = getTelegramWebApp()
    const closeSheet = () => setShowCustomMoodSheet(false)

    tg?.BackButton?.show?.()
    tg?.BackButton?.onClick?.(closeSheet)

    return () => {
      tg?.BackButton?.offClick?.(closeSheet)
      tg?.BackButton?.hide?.()
    }
  }, [showCustomMoodSheet])

  function closeCustomMoodSheet() {
    setShowCustomMoodSheet(false)
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('light')
  }

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

  const capture = useCallback(async () => {
    if (captureLockRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    if (!size) return

    captureLockRef.current = true
    setIsCapturing(true)

    // Let Telegram WebView paint the shutter feedback before canvas processing blocks the main thread.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    try {
      canvas.width  = size
      canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!

      // Draw raw frame — no ctx.filter (unreliable in Telegram WebView)
      const ox = (video.videoWidth  - size) / 2
      const oy = (video.videoHeight - size) / 2
      ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size)

      // Pixel-level processing (order: algo → filter → grain → flare)
      if (preset.algoType) {
        applyAlgo(ctx, canvas, preset.algoType)
      }

      applyFilter(ctx, canvas, preset.filter)

      applyGrain(ctx, canvas, preset.grain)

      // Auto-flare: 30% chance when using a film preset
      const AUTO_FLARES: FlareType[] = ['leak_warm', 'streak', 'leak_warm', 'leak_cool']
      const autoFlare: FlareType =
        preset.id !== 'none' && Math.random() < 0.30
          ? AUTO_FLARES[Math.floor(Math.random() * AUTO_FLARES.length)]
          : 'none'

      const effectiveFlare = selectedFlare !== 'none' ? selectedFlare : autoFlare

      if (effectiveFlare !== 'none') {
        applyFlare(ctx, canvas, effectiveFlare)
      }

      canvas.toBlob(blob => {
        captureLockRef.current = false
        setIsCapturing(false)
        if (!blob) return
        setPhotoBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        streamRef.current?.getTracks().forEach(t => t.stop())
        setPhase('preview')
      }, 'image/jpeg', 0.92)
    } catch (err) {
      console.error('[Camera] capture failed:', err)
      captureLockRef.current = false
      setIsCapturing(false)
      setCamError('Не удалось снять кадр')
    }
  }, [preset, selectedFlare])

  // ── Hardware volume buttons → shutter ────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'viewfinder' || limitReached || isCapturing) return

    const handleKey = (e: KeyboardEvent) => {
      // Volume Up (24) / Volume Down (25) on Android WebView
      // Some devices also emit AudioVolume* key names
      const isVolumeKey =
        e.keyCode === 24 ||
        e.keyCode === 25 ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'AudioVolumeDown' ||
        e.key === 'VolumeUp' ||
        e.key === 'VolumeDown'

      if (isVolumeKey) {
        e.preventDefault()
        void capture()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [phase, limitReached, isCapturing, capture])

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function publish() {
    if (!photoBlob || !user) return
    if (!mood) {
      setError('Выбери эмоцию кадра')
      return
    }
    setPhase('uploading')
    setError(null)
    try {
      // Server-side double-check before upload (DB trigger is the final guard)
      const currentCount = await getTodaysMomentCount(user.id)
      if (currentCount >= DAILY_FRAME_LIMIT) {
        setTodayCount(currentCount)
        setError('Лимит кадров на сегодня исчерпан')
        setPhase('preview')
        return
      }
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('moments')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' })
      if (upErr) throw new Error(upErr.message)

      const { data: { publicUrl } } = supabase.storage.from('moments').getPublicUrl(fileName)
      const { data: insertedMoment, error: insErr } = await supabase.from('moments').insert({
        user_id:          user.id,
        photo_url:        publicUrl,
        caption:          caption.trim() || null,
        mood:             mood ?? null,
        custom_mood_emoji: mood === 'custom' ? customMoodEmoji || null : null,
        custom_mood_label: mood === 'custom' ? customMoodLabel || null : null,
        film_preset_id:   preset.id !== 'none' ? preset.id : null,
        is_public:        true,
        visibility:       'public',
      })
        .select('id')
        .single()
      if (insErr) throw new Error(insErr.message)
      if (insertedMoment?.id) {
        const { error: reactionErr } = await addReaction(insertedMoment.id, user.id, mood)
        if (reactionErr) console.error('[Upload] initial reaction failed:', reactionErr)
      }

      trackPhotoPosted(preset.id)
      setTodayCount(prev => (prev ?? 0) + 1)
      setPhase('success')
      setTimeout(() => navigate('/'), 2600)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('daily_frame_limit_exceeded')) {
        setError('Лимит кадров на сегодня исчерпан')
        setTodayCount(DAILY_FRAME_LIMIT)
      } else {
        setError('Ошибка при публикации')
      }
      setPhase('preview')
    }
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPhotoBlob(null)
    setCaption('')
    setMood(null)
    setCustomMoodEmoji('')
    setCustomMoodLabel('')
    captureLockRef.current = false
    setIsCapturing(false)
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
    return <DevelopingScreen previewUrl={previewUrl} preset={preset} />
  }

  // ── PREVIEW phase ─────────────────────────────────────────────────────────

  if (phase === 'preview' || phase === 'uploading') {
    return (
      <div style={{ ...S.root, overflowY: 'auto', paddingTop: 'var(--tg-top, 56px)' }}>
        {/* Sticky back bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(13,13,13,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={retake}
            disabled={phase === 'uploading'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', color: '#C4A882',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              padding: '4px 0', opacity: phase === 'uploading' ? 0.4 : 1,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>←</span>
            <span>Переснять</span>
          </button>
        </div>

        <FilmStripBar />

        <img
          src={previewUrl ?? ''}
          alt=""
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 16px 4px', alignItems: 'center' }}>
          {preset.id !== 'none' && (
            <>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: preset.color,
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
                  onClick={() => {
                    setMood(active ? null : e.type)
                    if (!active) { setCustomMoodEmoji(''); setCustomMoodLabel('') }
                  }}
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

            {/* Custom emotion chip (when set) */}
            {customMoodLabel ? (
              <button
                onClick={() => { setMood(null); setCustomMoodEmoji(''); setCustomMoodLabel('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 13px', borderRadius: 20,
                  border: 'none', background: 'var(--amber)',
                  color: '#140E0A', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span>{customMoodEmoji || '✦'}</span>
                <span>{customMoodLabel}</span>
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>✕</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setMood(null)
                  setDraftEmoji(customMoodEmoji)
                  setDraftLabel(customMoodLabel)
                  setShowCustomMoodSheet(true)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 20,
                  border: '1px dashed #3E3228', background: 'transparent',
                  color: '#555', fontSize: 13, cursor: 'pointer',
                }}
              >
                <span>+</span><span>Своя</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom emotion bottom sheet */}
        {showCustomMoodSheet && (
          <>
            <div
              onClick={closeCustomMoodSheet}
              style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.55)' }}
            />
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
              background: '#110C08', borderRadius: '20px 20px 0 0',
              borderTop: '1px solid #2E2218',
              padding: '12px 20px',
              paddingBottom: 'max(32px, calc(var(--tg-bottom, 0px) + 16px))',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Своя эмоция</p>
                  <p style={{ color: '#555', fontSize: 13, margin: 0 }}>Выбери эмодзи и назови её</p>
                </div>
                <button
                  onClick={closeCustomMoodSheet}
                  aria-label="Закрыть"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    border: '1px solid #2E2218',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-muted)',
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Emoji grid — no keyboard needed */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['😄','😂','🥰','😍','🤩','😎','🥺','😢','😭','😤','🤬','😰','😱','🤯','😴','🥱','😅','😬','🙄','😏','😒','😔','💀','🔥','💫','✨','💖','💔','🌅','🌙','🎭','📸','🤍','🖤','✦'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setDraftEmoji(emoji)}
                    style={{
                      width: 42, height: 42, borderRadius: 10, fontSize: 20,
                      background: draftEmoji === emoji ? 'rgba(196,168,130,0.2)' : 'rgba(255,255,255,0.05)',
                      border: draftEmoji === emoji ? '1px solid var(--amber)' : '1px solid #2E2218',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Label input */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                <div style={{
                  width: 54, height: 50, borderRadius: 10, flexShrink: 0,
                  background: '#1A1208', border: '1px solid #2E2218',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {draftEmoji || '✦'}
                </div>
                <input
                  value={draftLabel}
                  onChange={e => setDraftLabel(e.target.value)}
                  placeholder="Нежно, Дерзко..."
                  maxLength={24}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10,
                    background: '#1A1208', color: '#fff',
                    border: '1px solid #2E2218',
                    fontSize: 15, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (!draftLabel.trim()) return
                  setCustomMoodEmoji(draftEmoji || '✦')
                  setCustomMoodLabel(draftLabel.trim())
                  setMood('custom')
                  setShowCustomMoodSheet(false)
                }}
                disabled={!draftLabel.trim()}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 30,
                  background: draftLabel.trim() ? 'var(--amber)' : '#2E1A0A',
                  color: draftLabel.trim() ? '#140E0A' : '#555',
                  fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >
                Добавить
              </button>
            </div>
          </>
        )}

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
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          paddingTop: 'var(--tg-top, 56px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: cameraUi.topBarPadding }}>
          {/* Active film indicator */}
          {preset.id !== 'none' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '5px 12px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: preset.color }} />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{preset.name}</span>
            </div>
          ) : <div />}

          <button
            onClick={() => setFlash(f => !f)}
            disabled={isCapturing}
            style={{ ...S.topBtn, color: flash ? '#E8B84B' : '#fff', opacity: isCapturing ? 0.45 : 1 }}
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Viewfinder */}
      <div style={{ ...S.viewfinderArea, ...cameraUi.viewfinderArea }}>
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
            {isCapturing && <CaptureFeedback />}
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{ ...S.bottomPanel, ...cameraUi.bottomPanel }}>
        {/* Light leak selector */}
        <div style={{ display: 'flex', gap: cameraUi.controlGap, padding: '0 16px', alignItems: 'center' }}>
          {!isTinyCamera && <span style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>СВЕТ</span>}
          {(['none', 'leak_warm', 'leak_cool', 'edge_burn', 'streak'] as FlareType[]).map(f => {
            const active = selectedFlare === f
            return (
              <button
                key={f}
                onClick={() => setSelectedFlare(f)}
                disabled={isCapturing}
                style={{
                  width: cameraUi.flareButtonSize,
                  height: cameraUi.flareButtonSize,
                  borderRadius: cameraUi.flareButtonSize / 2,
                  border: `${active ? 2 : 1}px solid ${active ? 'var(--amber)' : '#333'}`,
                  background: active ? 'rgba(196,168,130,0.15)' : 'transparent',
                  color: active ? 'var(--amber)' : '#555',
                  fontSize: isTinyCamera ? 14 : 16, cursor: isCapturing ? 'default' : 'pointer',
                  opacity: isCapturing ? 0.45 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {flareLabels[f]}
              </button>
            )
          })}
        </div>

        {/* Film presets strip */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex', gap: cameraUi.filmGap, overflowX: 'auto',
            padding: '0 16px', alignItems: 'center',
          }}
        >
          {FILM_PRESETS.map(p => {
            const active = p.id === preset.id
            return (
              <button
                key={p.id}
                onClick={() => { setPreset(p); if (p.id !== 'none') trackFilterApplied(p.id) }}
                disabled={isCapturing}
                style={{
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isTinyCamera ? 2 : 5,
                  padding: isTinyCamera ? 2 : 4, borderRadius: 12,
                  border: `${active ? 2 : 1.5}px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  background: 'none', cursor: isCapturing ? 'default' : 'pointer',
                  opacity: isCapturing ? 0.45 : 1,
                }}
              >
                <div
                  style={{
                    width: cameraUi.filmIconSize,
                    height: cameraUi.filmIconSize,
                    borderRadius: cameraUi.filmIconSize / 2,
                    background: p.id === 'none' ? '#1A1A1A' : p.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                    border: active ? '2px solid var(--amber)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {p.id === 'none' ? (
                    <span style={{
                      position: 'absolute',
                      top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      color: active ? 'var(--amber)' : '#555', fontSize: 18, lineHeight: 1,
                    }}>∅</span>
                  ) : (
                    <div
                      style={{
                        width: isTinyCamera ? 12 : 16,
                        height: isTinyCamera ? 12 : 16,
                        borderRadius: isTinyCamera ? 6 : 8,
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    />
                  )}
                </div>
                {!isTinyCamera && (
                  <span style={{ color: active ? 'var(--amber)' : '#555', fontSize: 9, maxWidth: 52, textAlign: 'center', lineHeight: 1.2 }}>
                    {p.id === 'none' ? 'Без' : p.name.split(' ')[0]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Frame counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {Array.from({ length: DAILY_FRAME_LIMIT }).map((_, i) => {
              const isAvailable = todayCount === null || i >= framesUsed
              return (
                <div
                  key={i}
                  style={{
                    width: 22,
                    height: 14,
                    borderRadius: 3,
                    background: todayCount === null
                      ? 'rgba(255,255,255,0.06)'
                      : isAvailable
                        ? 'rgba(201,132,62,0.85)'
                        : 'rgba(255,255,255,0.05)',
                    border: isAvailable && todayCount !== null
                      ? '1px solid rgba(201,132,62,0.3)'
                      : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: isAvailable && todayCount !== null
                      ? '0 0 8px rgba(201,132,62,0.3)'
                      : 'none',
                    transition: 'background 0.3s, box-shadow 0.3s',
                  }}
                />
              )
            })}
          </div>
          <span style={{
            fontSize: 11,
            letterSpacing: 0.3,
            color: limitReached ? 'rgba(201,132,62,0.4)' : 'var(--text-muted)',
          }}>
            {todayCount === null
              ? ''
              : limitReached
                ? 'кадры обновятся в полночь'
                : `${framesRemaining} из ${DAILY_FRAME_LIMIT} кадров сегодня`
            }
          </span>
          {limitMsg && (
            <span style={{ fontSize: 12, color: 'rgba(201,132,62,0.7)', marginTop: 2 }}>
              Лимит на сегодня исчерпан
            </span>
          )}
        </div>

        {/* Shutter + flip */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: cameraUi.shutterGap, paddingBottom: cameraUi.shutterPaddingBottom }}>
          {/* spacer left */}
          <div style={{ width: cameraUi.flipButtonSize }} />

          <button
            onClick={() => {
              if (isCapturing) return
              if (limitReached) {
                setLimitMsg(true)
                setTimeout(() => setLimitMsg(false), 2000)
                return
              }
              void capture()
            }}
            disabled={isCapturing}
            style={{
              ...S.shutter,
              width: cameraUi.shutterSize,
              height: cameraUi.shutterSize,
              borderRadius: cameraUi.shutterSize / 2,
              opacity: limitReached ? 0.35 : isCapturing ? 0.78 : 1,
              cursor: limitReached || isCapturing ? 'default' : 'pointer',
              transform: isCapturing ? 'scale(0.94)' : 'scale(1)',
              transition: 'opacity 0.3s, transform 0.18s',
            }}
          >
            <div style={{
              ...S.shutterInner,
              width: cameraUi.shutterInnerSize,
              height: cameraUi.shutterInnerSize,
              borderRadius: cameraUi.shutterInnerSize / 2,
            }}>
              <div style={{
                ...S.shutterGlow,
                width: cameraUi.shutterGlowSize,
                height: cameraUi.shutterGlowSize,
                borderRadius: cameraUi.shutterGlowSize / 2,
              }} />
            </div>
          </button>

          <button
            onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}
            disabled={isCapturing}
            style={{
              width: cameraUi.flipButtonSize,
              height: cameraUi.flipButtonSize,
              borderRadius: cameraUi.flipButtonSize / 2,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: isTinyCamera ? 18 : 22, cursor: isCapturing ? 'default' : 'pointer',
              opacity: isCapturing ? 0.45 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ⇄
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Decorative film strip bar ────────────────────────────────────────────────

function CaptureFeedback() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'radial-gradient(circle at 50% 45%, rgba(255,238,205,0.20), rgba(20,14,10,0.54) 52%, rgba(20,14,10,0.72))',
        pointerEvents: 'none',
      }}
    >
      <style>
        {`
          @keyframes antigram-capture-flash {
            0% { opacity: 0; }
            10% { opacity: 0.9; }
            100% { opacity: 0; }
          }
          @keyframes antigram-capture-frame {
            0% { transform: scale(1.04); opacity: 0; }
            26% { opacity: 1; }
            100% { transform: scale(1); opacity: 0.92; }
          }
          @keyframes antigram-capture-run {
            0% { transform: translateX(-34px); opacity: 0.25; }
            50% { opacity: 1; }
            100% { transform: translateX(34px); opacity: 0.25; }
          }
        `}
      </style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: '#fff',
          animation: 'antigram-capture-flash 520ms ease-out forwards',
        }}
      />
      <div
        style={{
          width: 96,
          height: 72,
          borderRadius: 10,
          border: '1px solid rgba(243,224,193,0.38)',
          background: 'rgba(20,14,10,0.34)',
          boxShadow: '0 0 0 8px rgba(20,14,10,0.18), 0 18px 48px rgba(0,0,0,0.34)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          animation: 'antigram-capture-frame 720ms ease-out forwards',
        }}
      >
        <div
          style={{
            width: 68,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(243,224,193,0.95), transparent)',
            animation: 'antigram-capture-run 780ms ease-in-out infinite alternate',
          }}
        />
        <div style={{ position: 'absolute', inset: 7, border: '1px solid rgba(243,224,193,0.16)', borderRadius: 6 }} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '8px 13px',
          borderRadius: 18,
          background: 'rgba(20,14,10,0.66)',
          border: '1px solid rgba(201,132,62,0.28)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span style={{ color: '#F3E0C1', fontSize: 13, fontWeight: 800, letterSpacing: 0.2 }}>
          Снимаем кадр
        </span>
        <span style={{ color: 'rgba(243,224,193,0.58)', fontSize: 11 }}>
          держим момент на плёнке
        </span>
      </div>
    </div>
  )
}

function DevelopingScreen({ previewUrl, preset }: { previewUrl: string | null; preset: FilmPreset }) {
  return (
    <div style={{ ...S.root, background: '#0B0704', paddingTop: 'var(--tg-top, 56px)' }}>
      <style>
        {`
          @keyframes antigram-develop-scan {
            0% { transform: translateY(-120%); opacity: 0; }
            16% { opacity: 1; }
            84% { opacity: 1; }
            100% { transform: translateY(120%); opacity: 0; }
          }
          @keyframes antigram-develop-photo {
            0% { filter: sepia(1) contrast(0.72) brightness(0.48); opacity: 0.34; transform: scale(0.985); }
            55% { filter: sepia(0.62) contrast(0.9) brightness(0.78); opacity: 0.78; }
            100% { filter: sepia(0.18) contrast(1.05) brightness(1); opacity: 1; transform: scale(1); }
          }
          @keyframes antigram-develop-pulse {
            0%, 100% { opacity: 0.44; transform: scaleX(0.66); }
            50% { opacity: 1; transform: scaleX(1); }
          }
          @keyframes antigram-develop-grain {
            0% { transform: translate3d(0, 0, 0); }
            25% { transform: translate3d(-1.5%, 1%, 0); }
            50% { transform: translate3d(1%, -1.5%, 0); }
            75% { transform: translate3d(-0.5%, -1%, 0); }
            100% { transform: translate3d(0, 0, 0); }
          }
        `}
      </style>

      <FilmStripBar />

      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '24px 20px max(32px, calc(var(--tg-bottom, 0px) + 24px))',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 26%, rgba(201,132,62,0.18), transparent 34%), linear-gradient(180deg, rgba(20,14,10,0.2), rgba(11,7,4,0.92))',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-20%',
            opacity: 0.12,
            backgroundImage: 'repeating-radial-gradient(circle at 18% 22%, rgba(255,255,255,0.8) 0 0.7px, transparent 0.7px 3.2px)',
            animation: 'antigram-develop-grain 0.55s steps(2, end) infinite',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            width: 'min(72vw, 300px)',
            aspectRatio: '1',
            borderRadius: 18,
            padding: 10,
            background: '#120C07',
            border: '1px solid rgba(201,132,62,0.28)',
            boxShadow: '0 28px 80px rgba(0,0,0,0.55), 0 0 36px rgba(201,132,62,0.12)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 7,
              borderRadius: 13,
              border: '1px solid rgba(255,221,170,0.08)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                borderRadius: 12,
                animation: 'antigram-develop-photo 2.4s ease-out forwards',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1A1208, #2E1A0A 48%, #0B0704)',
              }}
            />
          )}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: 0,
              height: '72%',
              background: 'linear-gradient(180deg, transparent, rgba(255,201,118,0.20) 44%, rgba(255,241,210,0.32) 50%, rgba(255,201,118,0.16) 56%, transparent)',
              mixBlendMode: 'screen',
              animation: 'antigram-develop-scan 2.45s ease-in-out forwards',
              zIndex: 2,
            }}
          />
        </div>

        <div style={{ position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              borderRadius: 999,
              background: 'rgba(201,132,62,0.10)',
              border: '1px solid rgba(201,132,62,0.20)',
            }}
          >
            {preset.id !== 'none' && (
              <span style={{ width: 9, height: 9, borderRadius: 5, background: preset.color, boxShadow: `0 0 12px ${preset.color}` }} />
            )}
            <span style={{ color: 'rgba(232,196,144,0.78)', fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: 800 }}>
              {preset.id !== 'none' ? preset.name : 'Antigram film'}
            </span>
          </div>
          <h1 style={{ color: '#F3E0C1', fontSize: 24, lineHeight: 1.1, fontWeight: 800, margin: '4px 0 0', fontFamily: 'Georgia, serif' }}>
            Плёнка проявляется
          </h1>
          <p style={{ color: 'rgba(232,196,144,0.58)', fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: 280 }}>
            Кадр сохранился. Через мгновение он появится в ленте.
          </p>
          <div
            style={{
              width: 108,
              height: 3,
              borderRadius: 3,
              marginTop: 8,
              background: 'linear-gradient(90deg, transparent, rgba(201,132,62,0.95), transparent)',
              transformOrigin: 'center',
              animation: 'antigram-develop-pulse 1.15s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}

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

function getCameraUi(isCompact: boolean, isTiny: boolean) {
  const shutterSize = isTiny ? 64 : isCompact ? 72 : 84
  const shutterInnerSize = isTiny ? 56 : isCompact ? 62 : 74
  const flipButtonSize = isTiny ? 40 : isCompact ? 46 : 52

  return {
    topBarPadding: isTiny ? '6px 14px' : isCompact ? '8px 16px' : '12px 16px',
    viewfinderArea: {
      paddingTop: isTiny
        ? 'calc(var(--tg-top, 56px) + 52px)'
        : isCompact
          ? 'calc(var(--tg-top, 56px) + 62px)'
          : 'calc(var(--tg-top, 56px) + 80px)',
      paddingLeft: isTiny ? 12 : 16,
      paddingRight: isTiny ? 12 : 16,
      paddingBottom: isTiny ? 3 : isCompact ? 4 : 8,
      minHeight: 0,
    } satisfies React.CSSProperties,
    bottomPanel: {
      gap: isTiny ? 8 : isCompact ? 10 : 16,
      paddingTop: isTiny ? 6 : isCompact ? 8 : 12,
      flexShrink: 0,
    } satisfies React.CSSProperties,
    controlGap: isTiny ? 6 : 8,
    flareButtonSize: isTiny ? 30 : isCompact ? 32 : 36,
    filmGap: isTiny ? 7 : isCompact ? 8 : 10,
    filmIconSize: isTiny ? 36 : isCompact ? 42 : 48,
    shutterSize,
    shutterInnerSize,
    shutterGlowSize: isTiny ? 34 : isCompact ? 38 : 44,
    shutterGap: isTiny ? 20 : isCompact ? 26 : 32,
    shutterPaddingBottom: isTiny
      ? 'max(14px, calc(var(--tg-bottom,0px) + 10px))'
      : isCompact
        ? 'max(22px, calc(var(--tg-bottom,0px) + 14px))'
        : 'max(36px, calc(var(--tg-bottom,0px) + 24px))',
    flipButtonSize,
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    height: '100dvh',
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
    flexDirection: 'column',
    paddingTop: 'calc(var(--tg-top, 56px) + 80px)',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
  },
  viewfinderBox: {
    width: '100%',
    flex: 1,
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
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.15)',
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
