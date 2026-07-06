type TelegramCloudStorage = {
  getItem?: (key: string, callback: (error: string | null, value: string | null) => void) => void
  setItem?: (key: string, value: string, callback?: (error: string | null, success?: boolean) => void) => void
}

type TelegramHapticFeedback = {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
}

export type TelegramPlatformUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export type TelegramWebAppPlatform = {
  initData?: string
  initDataUnsafe?: { user?: TelegramPlatformUser; start_param?: string }
  platform?: string
  CloudStorage?: TelegramCloudStorage
  HapticFeedback?: TelegramHapticFeedback
  BackButton?: {
    show?: () => void
    hide?: () => void
    onClick?: (cb: () => void) => void
    offClick?: (cb: () => void) => void
  }
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  expand?: () => void
  requestFullscreen?: () => void
  isVersionAtLeast?: (version: string) => boolean
  ready?: () => void
  onEvent?: (event: string, handler: () => void) => void
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
  openInvoice?: (url: string, callback?: (status: string) => void) => void
  downloadFile?: (
    params: { url: string; file_name: string },
    callback?: (status: boolean | 'downloading' | 'cancelled' | 'failed' | 'finished' | string) => void,
  ) => void
  shareToStory?: (
    mediaUrl: string,
    params?: {
      text?: string
      widget_link?: {
        url: string
        name?: string
      }
    },
  ) => void
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
}

export type PlatformName = 'telegram' | 'web'

export type PlatformSafeArea = {
  top: number
  bottom: number
  left: number
  right: number
}

export function getTelegramWebApp(): TelegramWebAppPlatform | null {
  try {
    return (window as unknown as { Telegram?: { WebApp?: TelegramWebAppPlatform } }).Telegram?.WebApp ?? null
  } catch {
    return null
  }
}

export function isTelegramPlatform(): boolean {
  const tg = getTelegramWebApp()
  return Boolean(tg?.platform && tg.platform !== 'unknown')
}

export function getPlatformName(): PlatformName {
  return isTelegramPlatform() ? 'telegram' : 'web'
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? ''
}

export function getTelegramUser(): TelegramPlatformUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null
}

export function getPlatformSafeArea(): PlatformSafeArea {
  const tg = getTelegramWebApp()
  if (!tg || !isTelegramPlatform()) return { top: 0, bottom: 0, left: 0, right: 0 }

  return {
    top: (tg.contentSafeAreaInset?.top ?? 0) + (tg.safeAreaInset?.top ?? 0),
    bottom: (tg.contentSafeAreaInset?.bottom ?? 0) + (tg.safeAreaInset?.bottom ?? 0),
    left: (tg.contentSafeAreaInset?.left ?? 0) + (tg.safeAreaInset?.left ?? 0),
    right: (tg.contentSafeAreaInset?.right ?? 0) + (tg.safeAreaInset?.right ?? 0),
  }
}

export function setPlatformCssSafeArea(): void {
  const safeArea = getPlatformSafeArea()
  document.documentElement.style.setProperty('--tg-top', safeArea.top > 10 ? `${safeArea.top}px` : isTelegramPlatform() ? '60px' : '0px')
  document.documentElement.style.setProperty('--tg-bottom', safeArea.bottom > 0 ? `${safeArea.bottom}px` : '0px')
}

export function initPlatformShell(): void {
  const tg = getTelegramWebApp()
  if (!tg) {
    setPlatformCssSafeArea()
    return
  }

  tg.setHeaderColor?.('#140E0A')
  tg.setBackgroundColor?.('#140E0A')
  tg.expand?.()

  if (!isTelegramPlatform()) {
    setPlatformCssSafeArea()
    tg.ready?.()
    return
  }

  setPlatformCssSafeArea()

  if (tg.requestFullscreen && (!tg.isVersionAtLeast || tg.isVersionAtLeast('8.0'))) {
    try {
      tg.requestFullscreen()
    } catch (error) {
      console.warn('[Platform] Telegram requestFullscreen failed:', error)
    }
  }

  tg.onEvent?.('contentSafeAreaChanged', setPlatformCssSafeArea)
  tg.onEvent?.('safeAreaChanged', setPlatformCssSafeArea)
  tg.ready?.()
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style)
  } catch {
    // Haptics are optional outside Telegram and older clients.
  }
}

export function withBackButton(onClick: () => void): () => void {
  const backButton = getTelegramWebApp()?.BackButton
  backButton?.show?.()
  backButton?.onClick?.(onClick)

  return () => {
    backButton?.offClick?.(onClick)
    backButton?.hide?.()
  }
}

export function hapticNotification(type: 'error' | 'success' | 'warning'): void {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type)
  } catch {
    // Haptics are optional outside Telegram and older clients.
  }
}

export function setVerticalSwipesEnabled(enabled: boolean): void {
  try {
    const tg = getTelegramWebApp()
    if (enabled) tg?.enableVerticalSwipes?.()
    else tg?.disableVerticalSwipes?.()
  } catch {
    // Older Telegram clients simply do not support this API.
  }
}

export function openExternalLink(url: string): void {
  const tg = getTelegramWebApp()
  if (typeof tg?.openLink === 'function') {
    tg.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function shareFileFromUrl(url: string, fileName: string): Promise<boolean> {
  if (!navigator.share || typeof File === 'undefined') return false

  try {
    const response = await fetch(url)
    if (!response.ok) return false

    const blob = await response.blob()
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    const canShareFiles = typeof navigator.canShare === 'function'
      ? navigator.canShare({ files: [file] })
      : true

    if (!canShareFiles) return false

    await navigator.share({ files: [file], title: 'Antigram' })
    return true
  } catch {
    return false
  }
}

function downloadWithAnchor(url: string, fileName: string): boolean {
  if (typeof document === 'undefined') return false

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  } catch {
    return false
  }
}

export async function downloadOrOpenFile(url: string, fileName: string): Promise<void> {
  const tg = getTelegramWebApp()
  if (typeof tg?.downloadFile === 'function') {
    const status = await new Promise<boolean | string>(resolve => {
      const timeout = window.setTimeout(() => resolve('timeout'), 2500)
      try {
        tg.downloadFile?.({ url, file_name: fileName }, result => {
          window.clearTimeout(timeout)
          resolve(result)
        })
      } catch {
        window.clearTimeout(timeout)
        resolve('failed')
      }
    })

    if (status === true || status === 'finished' || status === 'downloading') return
  }

  if (await shareFileFromUrl(url, fileName)) return
  if (downloadWithAnchor(url, fileName)) return

  openExternalLink(url)
}

export function openPlatformInvoice(invoiceLink: string): Promise<string> {
  const tg = getTelegramWebApp()

  if (typeof tg?.openInvoice === 'function') {
    return new Promise(resolve => {
      tg.openInvoice?.(invoiceLink, status => resolve(status))
    })
  }

  openExternalLink(invoiceLink)
  return Promise.resolve('opened')
}

export function openTelegramLink(url: string): void {
  const tg = getTelegramWebApp()
  if (typeof tg?.openTelegramLink === 'function') {
    tg.openTelegramLink(url)
    return
  }
  window.location.href = url
}

export function getPlatformStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setPlatformStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Persistence is a comfort feature; the UI should keep working.
    }
  }

  try {
    getTelegramWebApp()?.CloudStorage?.setItem?.(key, value)
  } catch {
    // CloudStorage is available only inside supported Telegram clients.
  }
}

export function getPlatformCloudStorageItem(key: string): Promise<string | null> {
  const storage = getTelegramWebApp()?.CloudStorage
  if (!storage?.getItem) return Promise.resolve(null)

  return new Promise(resolve => {
    try {
      storage.getItem?.(key, (_error, value) => resolve(value))
    } catch {
      resolve(null)
    }
  })
}
