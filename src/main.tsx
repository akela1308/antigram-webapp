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
  const contentTop = tg.contentSafeAreaInset?.top ?? 0
  const deviceTop = tg.safeAreaInset?.top ?? 0

  let topValue: string
  if (contentTop > 0) {
    // Telegram API gives exact value (Bot API 8.0+)
    topValue = `${contentTop}px`
  } else if (deviceTop > 0) {
    // Have device safe area, add ~50px for Telegram header
    topValue = `${deviceTop + 50}px`
  } else {
    // Fallback: CSS env() for device notch + ~50px for Telegram header
    // Works even without JS API — env(safe-area-inset-top) reads from native iOS
    topValue = 'calc(env(safe-area-inset-top, 44px) + 50px)'
  }

  document.documentElement.style.setProperty('--tg-top', topValue)

  const contentBottom = tg.contentSafeAreaInset?.bottom ?? 0
  const deviceBottom = tg.safeAreaInset?.bottom ?? 0
  const bottomValue = Math.max(contentBottom, deviceBottom)
  document.documentElement.style.setProperty(
    '--tg-bottom',
    bottomValue > 0 ? `${bottomValue}px` : 'env(safe-area-inset-bottom, 0px)',
  )
}

function initTelegram() {
  const tg = getTgWebApp()
  if (!tg) {
    // Not in Telegram — no offset needed
    document.documentElement.style.setProperty('--tg-top', '0px')
    document.documentElement.style.setProperty('--tg-bottom', '0px')
    return
  }

  tg.setHeaderColor?.('#140E0A')
  tg.setBackgroundColor?.('#140E0A')
  tg.expand?.()

  applyTelegramSafeArea(tg)

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
