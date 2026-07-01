import type { PremiumSubscription } from './types'

export const PREMIUM_ENABLED = false
export const PREMIUM_PRICE_STARS = 149
export const PREMIUM_PERIOD_DAYS = 30
export const PREMIUM_REGULAR_DAILY_FRAME_LIMIT = 4
export const PREMIUM_DAILY_FRAME_LIMIT = 8
export const PREMIUM_REGULAR_HIGHLIGHT_LIMIT = 5
export const PREMIUM_HIGHLIGHT_LIMIT = 10
export const PREMIUM_SUBSCRIPTION_PERIOD_SECONDS = 30 * 24 * 60 * 60

export function getDailyFrameLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_DAILY_FRAME_LIMIT : PREMIUM_REGULAR_DAILY_FRAME_LIMIT
}

export function getHighlightLimit(isPremium: boolean): number {
  return isPremium ? PREMIUM_HIGHLIGHT_LIMIT : PREMIUM_REGULAR_HIGHLIGHT_LIMIT
}

export function isPremiumSubscriptionActive(subscription: PremiumSubscription | null | undefined): boolean {
  if (!subscription || subscription.status !== 'active' || !subscription.expires_at) return false
  return new Date(subscription.expires_at).getTime() > Date.now()
}
