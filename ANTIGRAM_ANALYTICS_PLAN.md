# Antigram Analytics Plan

This document keeps product analytics event names consistent across Codex, Claude, and manual implementation work.

## Principles

- Do not send PII, raw Telegram initData, captions, search text, support text, or file names.
- Prefer stable enums and IDs over free text.
- Track product intent and funnel progress, not every render.
- Analytics must never block or crash the app.

## Activation Funnel

Events:

- `miniapp_opened`
- `telegram_auth_started`
- `telegram_auth_succeeded`
- `profile_created`
- `first_moment_started`
- `first_moment_posted`

Goal: understand whether a new user reaches their first published frame.

## Creation Funnel

Events:

- `upload_started`
- `film_selected`
- `camera_capture_taken`
- `mood_selected`
- `moment_posted`
- `upload_failed`

Safe properties:

- `source`: `camera`, `loaded_film`, `gallery`, `post_success`
- `film_id`
- `mood`
- `reason`

Goal: identify where capture/posting fails or feels too heavy.

## Engagement Funnel

Events:

- `reaction_sent`
- `comment_posted`
- `moment_saved`
- `profile_followed`
- `profile_opened`
- `album_opened`

Safe properties:

- `reaction`
- `source`
- `type`

Goal: measure whether people interact after browsing.

## Discovery Funnel

Events:

- `search_submitted`
- `search_result_opened`
- `mood_channel_opened`
- `mood_channel_followed`

Safe properties:

- `scope`
- `type`
- `mood`

Do not send raw search query text.

## Growth Funnel

Events:

- `share_card_opened`
- `share_card_sent`
- `story_share_opened`
- `invite_friend_opened`
- `friend_first_post_attributed`

Safe properties:

- `source`
- `target`

Goal: understand Telegram-native sharing without exposing private URLs as product analytics text.

## Monetization Funnel

Events:

- `stars_invoice_created`
- `stars_payment_succeeded`
- `premium_page_viewed`
- `premium_started`
- `premium_activated`

Safe properties:

- `amount`
- `source`

Goal: measure intent and completion without storing payment credentials or raw webhook payloads in analytics.

## Trust Funnel

Events:

- `report_submitted`
- `support_request_submitted`
- `image_load_slow`
- `safe_area_fallback_used`

Safe properties:

- `target`
- `surface`

Goal: spot safety/support issues before they become user churn.

## Current Implementation Notes

- Analytics lives in `src/lib/analytics.ts`.
- PostHog key is read from `VITE_POSTHOG_KEY`.
- Events are sent through direct HTTP capture to avoid adding the browser SDK to the Mini App bundle.
- Existing alias helpers remain for compatibility, for example `trackPhotoPosted = trackMomentPosted`.
