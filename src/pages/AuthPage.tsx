import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password, displayName)

    setLoading(false)

    if (result.error) {
      const err = result.error as { message?: string }
      setError(err?.message ?? 'Произошла ошибка')
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-wide mb-1" style={{ color: 'var(--amber)' }}>
          ANTIGRAM
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Реальные моменты, настоящие эмоции
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        {mode === 'register' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Имя</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Как тебя зовут"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-warm)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-warm)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Минимум 6 символов"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--bg-warm)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#E06060' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity"
          style={{
            background: 'var(--amber)',
            color: '#140E0A',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null) }}
          className="text-sm text-center py-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </form>
    </div>
  )
}
