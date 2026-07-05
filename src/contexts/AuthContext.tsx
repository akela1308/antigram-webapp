import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { getProfile } from '../lib/db'
import { identify, reset, trackTelegramAuthStarted, trackTelegramAuthSucceeded } from '../lib/analytics'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isTelegram: boolean
  telegramUser: TelegramUser | null
  telegramAuthLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: unknown }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: unknown }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
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

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

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
      await loadProfile(data.session.user.id)
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
        await loadProfile(existingSession.user.id)
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
      if (s?.user) loadProfile(s.user.id)
      else {
        setProfile(null)
        reset()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [authenticateTelegram, loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error, data } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName,
      })
    }
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isTelegram,
        telegramUser,
        telegramAuthLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
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
