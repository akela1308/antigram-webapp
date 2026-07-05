// PostHog analytics — direct HTTP (no SDK dependency, safe for Mini App WebView)

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let _distinctId: string | null = null
let _anonymousId: string | null = null

function getAnonymousId(): string {
  if (_anonymousId) return _anonymousId

  try {
    const key = 'antigram:anonymous-id'
    const existing = localStorage.getItem(key)
    if (existing) {
      _anonymousId = existing
      return existing
    }

    const created = crypto.randomUUID()
    localStorage.setItem(key, created)
    _anonymousId = created
    return created
  } catch {
    _anonymousId = `anon_${Math.random().toString(36).slice(2)}`
    return _anonymousId
  }
}

async function post(body: object): Promise<void> {
  if (!POSTHOG_KEY) return
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // analytics must never crash the app
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  _distinctId = userId
  post({
    api_key: POSTHOG_KEY,
    distinct_id: userId,
    event: '$identify',
    properties: { $set: { ...traits } },
  })
}

export function reset(): void {
  _distinctId = null
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!POSTHOG_KEY) return
  post({
    api_key: POSTHOG_KEY,
    distinct_id: _distinctId ?? getAnonymousId(),
    event,
    properties: { ...properties, $lib: 'antigram-tg' },
  })
}

// ── Canonical product events ──────────────────────────────────────────────────

export const trackMiniAppOpened = () => track('miniapp_opened')
export const trackTelegramAuthStarted = () => track('telegram_auth_started')
export const trackTelegramAuthSucceeded = () => track('telegram_auth_succeeded')
export const trackProfileCreated = () => track('profile_created')
export const trackFirstMomentStarted = () => track('first_moment_started')
export const trackFirstMomentPosted = () => track('first_moment_posted')

export const trackUploadStarted = (source: string) => track('upload_started', { source })
export const trackFilmSelected = (filmId: string) => track('film_selected', { film_id: filmId })
export const trackCameraCaptureTaken = () => track('camera_capture_taken')
export const trackMoodSelected = (mood: string) => track('mood_selected', { mood })
export const trackMomentPosted = (filmId: string) => track('moment_posted', { film_id: filmId })
export const trackUploadFailed = (reason: string) => track('upload_failed', { reason })

export const trackReactionSent = (reaction: string) => track('reaction_sent', { reaction })
export const trackCommentPosted = () => track('comment_posted')
export const trackMomentSaved = () => track('moment_saved')
export const trackProfileFollowed = () => track('profile_followed')
export const trackProfileOpened = (source: string) => track('profile_opened', { source })
export const trackAlbumOpened = (source: string) => track('album_opened', { source })
export const trackAlbumCreated = () => track('album_created')

export const trackSearchSubmitted = (scope: string) => track('search_submitted', { scope })
export const trackSearchResultOpened = (type: string) => track('search_result_opened', { type })
export const trackMoodChannelOpened = (mood: string) => track('mood_channel_opened', { mood })
export const trackMoodChannelFollowed = (mood: string) => track('mood_channel_followed', { mood })

export const trackShareCardOpened = (source: string) => track('share_card_opened', { source })
export const trackShareCardSent = (target: string) => track('share_card_sent', { target })
export const trackStoryShareOpened = (source: string) => track('story_share_opened', { source })
export const trackInviteFriendOpened = (source: string) => track('invite_friend_opened', { source })
export const trackFriendFirstPostAttributed = () => track('friend_first_post_attributed')

export const trackStarsInvoiceCreated = (amount: number) => track('stars_invoice_created', { amount })
export const trackStarsPaymentSucceeded = (amount: number) => track('stars_payment_succeeded', { amount })
export const trackPremiumPageViewed = (source: string) => track('premium_page_viewed', { source })
export const trackPremiumStarted = () => track('premium_started')
export const trackPremiumActivated = () => track('premium_activated')

export const trackReportSubmitted = (target: string) => track('report_submitted', { target })
export const trackSupportRequestSubmitted = () => track('support_request_submitted')
export const trackImageLoadSlow = (surface: string) => track('image_load_slow', { surface })
export const trackSafeAreaFallbackUsed = () => track('safe_area_fallback_used')

// ── Backward-compatible helper names used by existing screens ────────────────

export const trackPhotoPosted = trackMomentPosted
export const trackReactionAdded = trackReactionSent
export const trackUserFollowed = trackProfileFollowed
export const trackFilterApplied = trackFilmSelected
export const trackCommentAdded = trackCommentPosted
export const trackSessionStart = trackMiniAppOpened
