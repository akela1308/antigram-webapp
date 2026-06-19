import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

type TgWebApp = {
  initData?: string
  platform?: string
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
  const deviceTop  = tg.safeAreaInset?.top ?? 0
  const platform   = tg.platform ?? ''

  let topValue: string
  if (contentTop > 0) {
    // Bot API 8.0+ / Telegram 11+: точное значение, учитывает и notch и шапку Telegram
    topValue = `${contentTop}px`
  } else if (deviceTop > 0) {
    // Bot API 7.10+: только notch устройства — добавляем 56px для шапки Telegram
    topValue = `${deviceTop + 56}px`
  } else {
    // Старые клиенты без API safe area — определяем по платформе
    if (platform === 'ios' || platform === 'macos') {
      // iOS: есть notch/Dynamic Island, env() работает
      topValue = `max(calc(env(safe-area-inset-top, 0px) + 56px), 96px)`
    } else if (platform === 'android' || platform === 'android_x') {
      // Android: нет env() safe area, только шапка Telegram (~56px)
      topValue = '56px'
    } else {
      // desktop/tdesktop/weba — шапка не мешает или отсутствует
      topValue = '0px'
    }
  }

  document.documentElement.style.setProperty('--tg-top', topValue)

  const contentBottom = tg.contentSafeAreaInset?.bottom ?? 0
  const deviceBottom  = tg.safeAreaInset?.bottom ?? 0
  const bottomValue   = Math.max(contentBottom, deviceBottom)
  document.documentElement.style.setProperty(
    '--tg-bottom',
    bottomValue > 0
      ? `${bottomValue}px`
      : (platform === 'ios' ? 'env(safe-area-inset-bottom, 20px)' : '0px'),
  )
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
