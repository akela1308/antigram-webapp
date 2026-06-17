import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// Apply Telegram Mini App theme colors
function applyTelegramTheme() {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: {
      setHeaderColor?: (color: string) => void
      setBackgroundColor?: (color: string) => void
      expand?: () => void
      ready?: () => void
      headerColor?: string
    } } }).Telegram

    if (tg?.WebApp) {
      tg.WebApp.setHeaderColor?.('#140E0A')
      tg.WebApp.setBackgroundColor?.('#140E0A')
      tg.WebApp.expand?.()
      tg.WebApp.ready?.()
    }
  } catch {
    // Not in Telegram context — ignore
  }
}

applyTelegramTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
