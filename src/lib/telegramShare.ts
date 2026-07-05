type TelegramWebApp = {
  isVersionAtLeast?: (version: string) => boolean
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
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
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
  }
}

type ShareLanguage = 'ru' | 'en'

interface MomentShareParams {
  momentId: string
  photoUrl?: string | null
  caption?: string | null
  language: ShareLanguage
}

function getTelegramWebApp(): TelegramWebApp | null {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null
}

export function buildMomentUrl(momentId: string): string {
  return `${window.location.origin}/moment/${momentId}`
}

export function buildMomentShareText(caption: string | null | undefined, language: ShareLanguage): string {
  const trimmedCaption = caption?.trim()
  const intro = language === 'ru' ? 'Кадр в Antigram' : 'A frame on Antigram'

  if (!trimmedCaption) return intro
  return `${intro}: ${trimmedCaption}`
}

export function canShareMomentToStory(): boolean {
  const tg = getTelegramWebApp()
  return Boolean(
    tg &&
    typeof tg.shareToStory === 'function' &&
    (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('7.8')),
  )
}

export async function shareMomentToChat({ momentId, caption, language }: MomentShareParams): Promise<void> {
  const url = buildMomentUrl(momentId)
  const text = buildMomentShareText(caption, language)
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const tg = getTelegramWebApp()

  tg?.HapticFeedback?.impactOccurred?.('light')

  if (typeof tg?.openTelegramLink === 'function') {
    tg.openTelegramLink(telegramShareUrl)
    return
  }

  if (navigator.share) {
    await navigator.share({ title: 'Antigram', text, url })
    return
  }

  await navigator.clipboard?.writeText(`${text}\n${url}`)
}

export async function shareMomentToStory(params: MomentShareParams): Promise<void> {
  const { momentId, photoUrl, caption, language } = params
  const tg = getTelegramWebApp()

  if (photoUrl && canShareMomentToStory() && typeof tg?.shareToStory === 'function') {
    const url = buildMomentUrl(momentId)
    const text = buildMomentShareText(caption, language).slice(0, 200)

    tg.HapticFeedback?.impactOccurred?.('light')
    tg.shareToStory(photoUrl, {
      text,
      widget_link: {
        url,
        name: 'Open [A]',
      },
    })
    return
  }

  await shareMomentToChat(params)
}

