import { getTelegramWebApp, hapticImpact, openTelegramLink } from './platform'

type ShareLanguage = 'ru' | 'en'

interface MomentShareParams {
  momentId: string
  photoUrl?: string | null
  caption?: string | null
  language: ShareLanguage
  referralCode?: string | null
}

function cleanTelegramName(value: string | undefined): string {
  return (value ?? '').trim().replace(/^@/, '').replace(/^\//, '').replace(/\/$/, '')
}

function cleanReferralCode(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').trim().toLowerCase()
  return /^[a-z0-9_-]{4,24}$/.test(cleaned) ? cleaned : null
}

export function buildMomentStartParam(momentId: string, referralCode?: string | null): string {
  const cleanCode = cleanReferralCode(referralCode)
  return cleanCode ? `moment_${momentId}_ref_${cleanCode}` : `moment_${momentId}`
}

export function buildMiniAppUrl(startParam?: string): string | null {
  const botUsername = cleanTelegramName(import.meta.env.VITE_TELEGRAM_BOT_USERNAME)
  const appName = cleanTelegramName(import.meta.env.VITE_TELEGRAM_APP_NAME)

  if (!botUsername) return null

  const path = appName ? `${botUsername}/${appName}` : botUsername
  const query = startParam ? `?startapp=${encodeURIComponent(startParam)}` : ''

  return `https://t.me/${path}${query}`
}

export function buildMomentUrl(momentId: string, referralCode?: string | null): string {
  return buildMiniAppUrl(buildMomentStartParam(momentId, referralCode)) ?? `${window.location.origin}/moment/${momentId}`
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

export async function shareMomentToChat({ momentId, caption, language, referralCode }: MomentShareParams): Promise<void> {
  const url = buildMomentUrl(momentId, referralCode)
  const text = buildMomentShareText(caption, language)
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const tg = getTelegramWebApp()

  hapticImpact('light')

  if (typeof tg?.openTelegramLink === 'function') {
    openTelegramLink(telegramShareUrl)
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
    const url = buildMomentUrl(momentId, params.referralCode)
    const text = buildMomentShareText(caption, language).slice(0, 200)

    hapticImpact('light')
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
