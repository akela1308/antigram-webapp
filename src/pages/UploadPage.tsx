import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
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

      const { data: { publicUrl } } = supabase.storage
        .from('moments')
        .getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('moments').insert({
        user_id: user.id,
        photo_url: publicUrl,
        caption: caption.trim() || null,
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
          paddingTop: 16,
          paddingBottom: 12,
          background: 'rgba(20,14,10,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--text-muted)' }}
          className="text-sm"
        >
          Отмена
        </button>
        <h1 className="font-bold" style={{ color: 'var(--text)' }}>Новый момент</h1>
        <button
          onClick={handlePublish}
          disabled={!file || uploading}
          className="text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ color: 'var(--amber)' }}
        >
          {uploading ? 'Публикация...' : 'Опубликовать'}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 pb-24">
        {/* Photo area */}
        {preview ? (
          <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '4/5' }}>
            <img
              src={preview}
              alt="preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => { setPreview(null); setFile(null) }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(20,14,10,0.75)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-opacity active:opacity-70"
            style={{ aspectRatio: '4/5', borderColor: 'var(--border)', background: 'var(--bg-warm)' }}
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
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Caption */}
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Добавь подпись..."
          rows={3}
          maxLength={300}
          className="w-full rounded-xl px-4 py-3 resize-none text-sm outline-none"
          style={{
            background: 'var(--bg-warm)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />

        {/* Public / private toggle */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: 'var(--bg-warm)', border: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {isPublic ? 'Публичный пост' : 'Приватный пост'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isPublic ? 'Виден всем пользователям' : 'Виден только тебе'}
            </p>
          </div>
          <button
            onClick={() => setIsPublic(p => !p)}
            className="relative w-12 h-7 rounded-full transition-colors"
            style={{ background: isPublic ? 'var(--amber)' : 'var(--border)' }}
          >
            <span
              className="absolute top-1 w-5 h-5 rounded-full transition-transform"
              style={{
                background: '#fff',
                left: 4,
                transform: isPublic ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#e05a5a' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
