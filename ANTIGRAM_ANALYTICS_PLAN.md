# Antigram Analytics Plan

Дата: 2026-07-05

## Цель

Сделать события PostHog предсказуемыми для продуктовых решений: активация, публикация первого кадра, реакции, шэринг, Premium/Stars, support и безопасность.

## Принципы

- Не отправлять raw Telegram `initData`.
- Не отправлять display name, username, email, текст сообщений, captions или support message.
- Для пользователя можно отправлять только `distinct_id`, который уже является внутренним Supabase user id.
- До авторизации используется локальный anonymous id без PII.
- Event names должны быть snake_case и описывать действие пользователя или системный результат.

## Canonical Events

### Activation

- `miniapp_opened`
- `telegram_auth_started`
- `telegram_auth_succeeded`
- `profile_created`
- `first_moment_started`
- `first_moment_posted`

### Creation

- `upload_started`
- `film_selected`
- `camera_capture_taken`
- `mood_selected`
- `moment_posted`
- `upload_failed`

### Engagement

- `reaction_sent`
- `comment_posted`
- `moment_saved`
- `profile_followed`
- `profile_opened`
- `album_opened`
- `album_created`

### Discovery

- `search_submitted`
- `search_result_opened`
- `mood_channel_opened`
- `mood_channel_followed`

### Growth

- `share_card_opened`
- `share_card_sent`
- `story_share_opened`
- `invite_friend_opened`
- `friend_first_post_attributed`

### Monetization

- `stars_invoice_created`
- `stars_payment_succeeded`
- `premium_page_viewed`
- `premium_started`
- `premium_activated`

### Trust

- `report_submitted`
- `support_request_submitted`
- `image_load_slow`
- `safe_area_fallback_used`

## Current Implementation

`src/lib/analytics.ts` exposes canonical helpers for all events above.

Older helper names still exist as aliases:

- `trackPhotoPosted` -> `moment_posted`
- `trackReactionAdded` -> `reaction_sent`
- `trackUserFollowed` -> `profile_followed`
- `trackFilterApplied` -> `film_selected`
- `trackCommentAdded` -> `comment_posted`
- `trackSessionStart` -> `miniapp_opened`

This lets existing screens keep working while we gradually rename imports.

## Next Instrumentation Tasks

1. Track `camera_capture_taken` when the camera button succeeds.
2. Track `mood_selected` when the user chooses a reaction/mood before publish.
3. Track `upload_failed` with a safe reason code, not raw error text.
4. Track `search_submitted` and `search_result_opened` in Search.
5. Track `profile_opened` and `album_opened`.
6. Track `stars_invoice_created` after invoice link creation and `stars_payment_succeeded` after confirmed success.
7. Add PostHog funnels:
   - open -> auth -> first moment started -> first moment posted;
   - moment opened -> reaction sent;
   - moment posted -> share card opened -> share card sent;
   - Stars modal opened -> invoice created -> payment succeeded.

## Dashboard Questions

- How many users publish a first moment in the first session?
- Which film presets lead to more posts?
- Which surfaces create the most reactions: feed, profile, search, moment detail?
- Does Telegram share lead to new user activation?
- How many users hit the daily frame limit and open Premium?
