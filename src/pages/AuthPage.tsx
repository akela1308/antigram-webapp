import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

export function AuthPage() {
  const {
    signIn,
    signUp,
    isTelegram,
    telegramUser,
    loginWithTelegram,
    telegramAuthLoading,
    sendPasswordReset,
    updatePassword,
    setRecoverySessionFromUrl,
  } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const isRecovery = params.get('mode') === 'recovery'
      || params.get('type') === 'recovery'
      || hashParams.get('type') === 'recovery'
      || Boolean(params.get('code'))

    if (!isRecovery) return

    setMode('reset')
    setLoading(true)
    setRecoverySessionFromUrl().then(ok => {
      if (!ok) setError(t('auth.resetLinkInvalid'))
      setLoading(false)
    })
  }, [setRecoverySessionFromUrl, t])

  const handleTelegramLogin = async () => {
    await loginWithTelegram()
    navigate('/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'forgot') {
      const result = await sendPasswordReset(email)
      setLoading(false)
      if (result.error) {
        const err = result.error as { message?: string }
        setError(err?.message ?? t('common.error'))
      } else {
        setMessage(t('auth.resetEmailSent'))
      }
      return
    }

    if (mode === 'reset') {
      if (password.length < 6 || password !== confirmPassword) {
        setLoading(false)
        setError(t('auth.passwordMismatch'))
        return
      }

      const result = await updatePassword(password)
      setLoading(false)
      if (result.error) {
        const err = result.error as { message?: string }
        setError(err?.message ?? t('common.error'))
      } else {
        setMessage(t('auth.passwordUpdated'))
        navigate('/', { replace: true })
      }
      return
    }

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, displayName)

    setLoading(false)

    if (result.error) {
      const err = result.error as { message?: string }
      setError(err?.message ?? t('common.error'))
    } else {
      navigate('/')
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)
    setMessage(null)
    setPassword('')
    setConfirmPassword('')
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
          {t('auth.tagline')}
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
              <span>{t('common.signingIn')}</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#140E0A">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                <span>
                  {t('auth.loginAs', { name: tgName ?? tgUsername ?? t('auth.telegramUser') })}
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
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('auth.or')}</span>
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
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('auth.name')}</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
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

        {mode !== 'reset' && (
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
        )}

        {mode !== 'forgot' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{mode === 'reset' ? t('auth.newPassword') : t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
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
        )}

        {mode === 'reset' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-warm)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-center" style={{ color: '#E06060' }}>{error}</p>
        )}
        {message && (
          <p className="text-sm text-center" style={{ color: 'var(--amber)', lineHeight: 1.45 }}>{message}</p>
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
          {loading ? '...' : mode === 'login'
            ? t('auth.emailLogin')
            : mode === 'register'
              ? t('auth.createAccount')
              : mode === 'forgot'
                ? t('auth.sendResetLink')
                : t('auth.updatePassword')}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="text-sm text-center py-1"
            style={{ color: 'var(--amber)' }}
          >
            {t('auth.forgotPassword')}
          </button>
        )}

        {mode !== 'reset' && (
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm text-center py-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          </button>
        )}
      </form>

      <p className="text-xs text-center mt-8 max-w-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('auth.termsPrefix')}{' '}
        <Link to="/terms" style={{ color: 'var(--amber)', textDecoration: 'none' }}>{t('auth.terms')}</Link>
        {' '}{t('auth.and')}{' '}
        <Link to="/privacy" style={{ color: 'var(--amber)', textDecoration: 'none' }}>{t('auth.privacy')}</Link>.
      </p>
    </div>
  )
}
