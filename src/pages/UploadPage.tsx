import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

export function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [mood, setMood] = useState<ReactionType | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError(null)
  }

  async function handlePublish() {
    if (!file || !user) return
    setUploading(true)
    setError(null)

    try {
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('moments')
        .upload(fileName, file, { contentType: file.type || 'image/jpeg' })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from('moments').getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('moments').insert({
        user_id: user.id,
        photo_url: publicUrl,
        caption: caption.trim() || null,
        mood: mood ?? null,
        is_public: isPublic,
      })

      if (insertError) throw new Error(insertError.message)

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при публикации')
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6" style={{ minHeight: '100dvh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Войдите, чтобы публиковать моменты</p>
        <button
          onClick={() => navigate('/auth')}
          className="px-6 py-3 rounded-xl font-semibold"
          style={{ background: 'var(--amber)', color: '#140E0A' }}
        >
          Войти
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: 'var(--tg-top, 0px)' }}>
      {/* Header */}
      <div
        className="sticky z-40 flex items-center justify-between px-4"
        style={{
          top: 'var(--tg-top, 0px)',
          paddingTop: 14,
          paddingBottom: 12,
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', padding: '4px 0' }}
        >
          Отмена
        </button>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, margin: 0, fontSize: 16 }}>Новый момент</h1>
        <button
          onClick={handlePublish}
          disabled={!file || uploading}
          style={{
            color: 'var(--amber)',
            background: 'none',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: !file || uploading ? 0.4 : 1,
            padding: '4px 0',
          }}
        >
          {uploading ? 'Публикация...' : 'Опубликовать'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 100px' }}>
        {/* Photo area */}
        {preview ? (
          <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', aspectRatio: '4/5' }}>
            <img
              src={preview}
              alt="preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <button
              onClick={() => { setPreview(null); setFile(null) }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(20,14,10,0.8)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              borderRadius: 16,
              border: '2px dashed var(--border)',
              background: 'var(--bg-warm)',
              aspectRatio: '4/5',
              cursor: 'pointer',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>Нажми, чтобы сделать фото</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Caption */}
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Добавь подпись..."
          rows={3}
          maxLength={300}
          style={{
            width: '100%',
            borderRadius: 12,
            padding: '12px 14px',
            resize: 'none',
            fontSize: 14,
            outline: 'none',
            background: 'var(--bg-warm)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: 'inherit',
          }}
        />

        {/* Атмосфера */}
        <div>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              margin: '0 0 10px',
            }}
          >
            ✦ Атмосфера
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EMOTIONS.map(e => {
              const isActive = mood === e.type
              return (
                <button
                  key={e.type}
                  onClick={() => setMood(isActive ? null : e.type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: isActive ? 'none' : '1px solid var(--border)',
                    background: isActive ? 'var(--amber)' : 'var(--bg-warm)',
                    color: isActive ? '#140E0A' : 'var(--text-muted)',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <span>{e.emoji}</span>
                  <span>{e.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Public / private toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--bg-warm)',
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, margin: 0 }}>
              {isPublic ? 'Публичный пост' : 'Приватный пост'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>
              {isPublic ? 'Виден всем пользователям' : 'Виден только тебе'}
            </p>
          </div>
          <button
            onClick={() => setIsPublic(p => !p)}
            style={{
              position: 'relative',
              width: 48,
              height: 28,
              borderRadius: 14,
              background: isPublic ? 'var(--amber)' : 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transform: isPublic ? 'translateX(20px)' : 'translateX(0)',
                transition: 'transform 0.2s',
                display: 'block',
              }}
            />
          </button>
        </div>

        {error && (
          <p style={{ color: '#e05a5a', fontSize: 14, textAlign: 'center', margin: 0 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
