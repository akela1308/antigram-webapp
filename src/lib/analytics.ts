// PostHog analytics — direct HTTP (no SDK dependency, safe for Mini App WebView)

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let _distinctId: string | null = null

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
  if (!_distinctId || !POSTHOG_KEY) return
  post({
    api_key: POSTHOG_KEY,
    distinct_id: _distinctId,
    event,
    properties: { ...properties, $lib: 'antigram-tg' },
  })
}

// ── Event helpers matching mobile's 8 events ──────────────────────────────────

export const trackPhotoPosted    = (presetId: string) => track('photo_posted', { preset: presetId })
export const trackReactionAdded  = (reaction: string) => track('reaction_added', { reaction })
export const trackUserFollowed   = ()                  => track('user_followed')
export const trackMomentSaved    = ()                  => track('moment_saved')
export const trackAlbumCreated   = ()                  => track('album_created')
export const trackFilterApplied  = (filterId: string)  => track('filter_applied', { filter_id: filterId })
export const trackCommentAdded   = ()                  => track('comment_added')
export const trackSessionStart   = ()                  => track('session_start')
