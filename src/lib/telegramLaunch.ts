type TelegramLaunchWebApp = {
  initDataUnsafe?: {
    start_param?: string
  }
}

export function getTelegramStartParam(): string | null {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramLaunchWebApp } }).Telegram
    return tg?.WebApp?.initDataUnsafe?.start_param ?? null
  } catch {
    return null
  }
}

export function getTelegramLaunchPath(startParam: string | null): string | null {
  if (!startParam) return null

  if (startParam.startsWith('moment_')) {
    const momentId = startParam.slice('moment_'.length)
    if (/^[a-zA-Z0-9_-]{6,80}$/.test(momentId)) {
      return `/moment/${momentId}`
    }
  }

  return null
}

