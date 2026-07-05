import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserEntitlements } from '../lib/types'
import { getProfile, getUserEntitlements } from '../lib/db'
import { identify, reset, trackTelegramAuthStarted, trackTelegramAuthSucceeded } from '../lib/analytics'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  entitlements: UserEntitlements | null
  isPremium: boolean
  loading: boolean
  isTelegram: boolean
  telegramUser: TelegramUser | null
  telegramAuthLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: unknown }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: unknown }>
  linkEmailPassword: (email: string, password: string) => Promise<{ error: unknown }>
  sendPasswordReset: (email: string) => Promise<{ error: unknown }>
  updatePassword: (password: string) => Promise<{ error: unknown }>
  setRecoverySessionFromUrl: () => Promise<boolean>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshEntitlements: () => Promise<void>
  loginWithTelegram: () => Promise<void>
}

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getTelegramUser(): TelegramUser | null {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramUser } } } }).Telegram
    return tg?.WebApp?.initDataUnsafe?.user ?? null
  } catch {
    return null
  }
}

function getInitDataRaw(): string {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram
    return tg?.WebApp?.initData ?? ''
  } catch {
    return ''
  }
}

function isTelegramContext(): boolean {
  const initData = getInitDataRaw()
  return initData.length > 0
}

function normalizeLoginEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? ''
  if (!normalized || normalized.endsWith('@antigram.internal')) return null
  return normalized
}

async function ensureEmailIdentity(userId: string, email: string | null | undefined): Promise<void> {
  const normalizedEmail = normalizeLoginEmail(email)
  if (!normalizedEmail) return

  const { error } = await supabase
    .from('account_identities')
    .upsert(
      {
        user_id: userId,
        provider: 'email',
        external_id: normalizedEmail,
        metadata: { email_login_enabled: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,external_id' },
    )

  if (error) {
    console.error('[Auth] email identity sync failed:', error)
  }
}

function getPasswordRecoveryRedirectUrl(): string {
  if (typeof window === 'undefined') return '/auth?mode=recovery'
  return `${window.location.origin}/auth?mode=recovery`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [telegramUser] = useState<TelegramUser | null>(getTelegramUser)
  const [isTelegram] = useState(isTelegramContext)
  const [telegramAuthLoading, setTelegramAuthLoading] = useState(false)

  const loadProfile = useCallback(async (userId: string) => {
    const p = await getProfile(userId)
    setProfile(p)
    identify(userId, {
      has_username: Boolean(p?.username),
      has_display_name: Boolean(p?.display_name),
      is_telegram: isTelegramContext(),
    })
  }, [])

  const loadEntitlements = useCallback(async (userId: string) => {
    const rights = await getUserEntitlements(userId)
    setEntitlements(rights)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  const refreshEntitlements = useCallback(async () => {
    if (user) await loadEntitlements(user.id)
  }, [user, loadEntitlements])

  // Telegram auth: send initData to Edge Function and get back a session
  const authenticateTelegram = useCallback(async () => {
    const initData = getInitDataRaw()
    if (!initData) return

    setTelegramAuthLoading(true)
    try {
      trackTelegramAuthStarted()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ initData }),
        },
      )

      const body = await res.json()

      if (!res.ok) {
        console.error('[TG Auth] Edge Function error:', res.status, body)
        setTelegramAuthLoading(false)
        return
      }

      const { access_token, refresh_token } = body as {
        access_token: string
        refresh_token: string
      }

      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (error || !data.session) {
        console.error('[TG Auth] setSession error:', error)
        setTelegramAuthLoading(false)
        return
      }

      setSession(data.session)
      setUser(data.session.user)
      await Promise.all([
        loadProfile(data.session.user.id),
        loadEntitlements(data.session.user.id),
      ])
      trackTelegramAuthSucceeded()
    } catch (err) {
      console.error('[TG Auth] fetch exception:', err)
    }
    setTelegramAuthLoading(false)
  }, [loadProfile])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // Check existing session first
      const { data: { session: existingSession } } = await supabase.auth.getSession()

      if (existingSession && mounted) {
        setSession(existingSession)
        setUser(existingSession.user)
        await Promise.all([
          loadProfile(existingSession.user.id),
          loadEntitlements(existingSession.user.id),
        ])
        setLoading(false)

        // Silently sync Telegram avatar_url in background (non-blocking)
        const tgUser = getTelegramUser()
        if (tgUser?.photo_url) {
          supabase.from('profiles')
            .update({ avatar_url: tgUser.photo_url })
            .eq('id', existingSession.user.id)
            .then(() => { if (mounted) loadProfile(existingSession.user.id) })
        }

        return
      }

      // If in Telegram and no existing session, try Telegram auth
      if (isTelegramContext() && mounted) {
        await authenticateTelegram()
      }

      if (mounted) setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfile(s.user.id)
        loadEntitlements(s.user.id)
      }
      else {
        setProfile(null)
        setEntitlements(null)
        reset()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [authenticateTelegram, loadEntitlements, loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      await ensureEmailIdentity(data.user.id, data.user.email ?? email)
    }
    return { error }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error, data } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
      })
      await ensureEmailIdentity(data.user.id, data.user.email ?? email)
    }
    return { error }
  }

  const sendPasswordReset = useCallback(async (email: string): Promise<{ error: unknown }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getPasswordRecoveryRedirectUrl(),
    })
    return { error }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<{ error: unknown }> => {
    const { error, data } = await supabase.auth.updateUser({ password })
    if (!error && data.user) {
      setUser(data.user)
      if (data.user.email) await ensureEmailIdentity(data.user.id, data.user.email)
    }
    return { error }
  }, [])

  const setRecoverySessionFromUrl = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false

    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error || !data.session) {
        console.error('[Auth] recovery code exchange failed:', error)
        return false
      }
      setSession(data.session)
      setUser(data.session.user)
      await Promise.all([
        loadProfile(data.session.user.id),
        loadEntitlements(data.session.user.id),
      ])
      window.history.replaceState(null, '', '/auth?mode=recovery')
      return true
    }

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error || !data.session) {
        console.error('[Auth] recovery session set failed:', error)
        return false
      }
      setSession(data.session)
      setUser(data.session.user)
      await Promise.all([
        loadProfile(data.session.user.id),
        loadEntitlements(data.session.user.id),
      ])
      window.history.replaceState(null, '', '/auth?mode=recovery')
      return true
    }

    const { data: { session: existingSession } } = await supabase.auth.getSession()
    return Boolean(existingSession)
  }, [loadEntitlements, loadProfile])

  const linkEmailPassword = async (email: string, password: string): Promise<{ error: unknown }> => {
    const { error } = await supabase.functions.invoke('link-email-auth', {
      body: { email, password },
    })
    if (!error) {
      const { data } = await supabase.auth.refreshSession()
      if (data.session) {
        setSession(data.session)
        setUser(data.session.user)
        await loadEntitlements(data.session.user.id)
      }
    }
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    setSession(null)
    setUser(null)
    setProfile(null)
    setEntitlements(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        entitlements,
        isPremium: Boolean(entitlements?.is_premium),
        loading,
        isTelegram,
        telegramUser,
        telegramAuthLoading,
        signIn,
        signUp,
        linkEmailPassword,
        sendPasswordReset,
        updatePassword,
        setRecoverySessionFromUrl,
        signOut,
        refreshProfile,
        refreshEntitlements,
        loginWithTelegram: authenticateTelegram,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
