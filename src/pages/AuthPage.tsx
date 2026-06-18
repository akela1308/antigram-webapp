import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AuthPage() {
  const { signIn, signUp, isTelegram, telegramUser, loginWithTelegram, telegramAuthLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTelegramLogin = async () => {
    await loginWithTelegram()
    navigate('/')
  }

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

  const tgName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ')
    : null
  const tgUsername = telegramUser?.username ? `@${telegramUser.username}` : null

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

      {/* Telegram login block */}
      {isTelegram && telegramUser && (
        <div className="w-full max-w-sm mb-6">
          <button
            onClick={handleTelegramLogin}
            disabled={telegramAuthLoading}
            className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-opacity"
            style={{
              background: 'var(--amber)',
              color: '#140E0A',
              opacity: telegramAuthLoading ? 0.7 : 1,
            }}
          >
            {telegramAuthLoading ? (
              <span>Входим...</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#140E0A">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                <span>
                  Войти как {tgName ?? tgUsername ?? 'пользователь Telegram'}
                </span>
              </>
            )}
          </button>
          {tgUsername && (
            <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {tgUsername}
            </p>
          )}

          <div className="flex items-center gap-3 my-5">
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>или</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        </div>
      )}

      {/* Email/password form */}
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
            background: 'rgba(201,132,62,0.15)',
            border: '1px solid var(--border)',
            color: 'var(--amber)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : mode === 'login' ? 'Войти по email' : 'Создать аккаунт'}
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
