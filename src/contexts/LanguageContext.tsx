import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AppLanguage = 'ru' | 'en'

interface LanguageContextValue {
  language: AppLanguage
  detectedLanguage: AppLanguage
  setLanguage: (language: AppLanguage) => void
}

type TelegramLanguageUser = {
  language_code?: string
}

const STORAGE_KEY = 'antigram:language'
const LanguageContext = createContext<LanguageContextValue | null>(null)

function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  return raw?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function getTelegramLanguage(): string | null {
  try {
    const tg = (window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramLanguageUser } } }
    }).Telegram
    return tg?.WebApp?.initDataUnsafe?.user?.language_code ?? null
  } catch {
    return null
  }
}

function getStoredLanguage(): AppLanguage | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'ru' || stored === 'en' ? stored : null
  } catch {
    return null
  }
}

function detectLanguage(): AppLanguage {
  const telegramLanguage = getTelegramLanguage()
  if (telegramLanguage) return normalizeLanguage(telegramLanguage)
  return normalizeLanguage(navigator.language)
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [detectedLanguage, setDetectedLanguage] = useState<AppLanguage>(() => detectLanguage())
  const [language, setLanguageState] = useState<AppLanguage>(() => getStoredLanguage() ?? detectLanguage())

  useEffect(() => {
    const detected = detectLanguage()
    setDetectedLanguage(detected)
    if (!getStoredLanguage()) setLanguageState(detected)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    detectedLanguage,
    setLanguage: (nextLanguage) => {
      setLanguageState(nextLanguage)
      try {
        localStorage.setItem(STORAGE_KEY, nextLanguage)
      } catch {
        // Ignore storage errors in restricted WebViews.
      }
    },
  }), [detectedLanguage, language])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
