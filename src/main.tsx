import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { PlayerProvider } from './contexts/PlayerContext'
import './index.css'

type TgWebApp = {
  initData?: string
  platform?: string
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  expand?: () => void
  requestFullscreen?: () => void
  isVersionAtLeast?: (version: string) => boolean
  ready?: () => void
  onEvent?: (event: string, handler: () => void) => void
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
}

function getTgWebApp(): TgWebApp | undefined {
  try {
    return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp
  } catch {
    return undefined
  }
}

function applyTelegramSafeArea(tg: TgWebApp) {
  // Sum both insets: contentSafeAreaInset = Telegram UI buttons, safeAreaInset = device notch
  const contentTop = tg.contentSafeAreaInset?.top ?? 0
  const deviceTop  = tg.safeAreaInset?.top ?? 0
  const totalTop   = contentTop + deviceTop
  document.documentElement.style.setProperty(
    '--tg-top',
    totalTop > 10 ? `${totalTop}px` : '60px',
  )

  const contentBottom = tg.contentSafeAreaInset?.bottom ?? 0
  const deviceBottom  = tg.safeAreaInset?.bottom ?? 0
  const totalBottom   = contentBottom + deviceBottom
  document.documentElement.style.setProperty(
    '--tg-bottom',
    totalBottom > 0 ? `${totalBottom}px` : '0px',
  )
}

function requestTelegramFullscreen(tg: TgWebApp) {
  if (!tg.requestFullscreen) return
  if (tg.isVersionAtLeast && !tg.isVersionAtLeast('8.0')) return

  try {
    tg.requestFullscreen()
  } catch (error) {
    console.warn('[Telegram] requestFullscreen failed:', error)
  }
}

function initTelegram() {
  const tg = getTgWebApp()
  if (!tg) {
    document.documentElement.style.setProperty('--tg-top', '0px')
    document.documentElement.style.setProperty('--tg-bottom', '0px')
    return
  }

  // Всегда вызываем при наличии объекта tg — expand() нужен даже с пустым initData
  tg.setHeaderColor?.('#140E0A')
  tg.setBackgroundColor?.('#140E0A')
  tg.expand?.()

  // Safe area — только если реально внутри Telegram (не в браузере)
  // В браузере telegram-web-app.js создаёт tg объект но platform = 'unknown' или ''
  const isInsideTelegram = tg.platform && tg.platform !== 'unknown'
  if (!isInsideTelegram) {
    document.documentElement.style.setProperty('--tg-top', '0px')
    document.documentElement.style.setProperty('--tg-bottom', '0px')
    tg.ready?.()
    return
  }

  applyTelegramSafeArea(tg)
  requestTelegramFullscreen(tg)

  tg.onEvent?.('contentSafeAreaChanged', () => applyTelegramSafeArea(tg))
  tg.onEvent?.('safeAreaChanged', () => applyTelegramSafeArea(tg))

  tg.ready?.()
}

initTelegram()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
