import { getTelegramWebApp } from './platform'

export function getTelegramStartParam(): string | null {
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null
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
