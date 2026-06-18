import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

type TgWebApp = {
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  expand?: () => void
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
  // contentSafeAreaInset.top = height of Telegram's own UI overlay at top
  const contentTop = tg.contentSafeAreaInset?.top ?? 0
  // safeAreaInset.top = device safe area (notch). Use whichever is larger.
  const deviceTop = tg.safeAreaInset?.top ?? 0
  const top = Math.max(contentTop, deviceTop)
  document.documentElement.style.setProperty('--tg-top', `${top}px`)

  const bottom = Math.max(tg.contentSafeAreaInset?.bottom ?? 0, tg.safeAreaInset?.bottom ?? 0)
  document.documentElement.style.setProperty('--tg-bottom', `${bottom}px`)
}

function initTelegram() {
  const tg = getTgWebApp()
  if (!tg) return

  tg.setHeaderColor?.('#140E0A')
  tg.setBackgroundColor?.('#140E0A')
  tg.expand?.()

  applyTelegramSafeArea(tg)

  // Re-apply when Telegram notifies of changes (e.g. rotation)
  tg.onEvent?.('contentSafeAreaChanged', () => applyTelegramSafeArea(tg))
  tg.onEvent?.('safeAreaChanged', () => applyTelegramSafeArea(tg))

  tg.ready?.()
}

initTelegram()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
