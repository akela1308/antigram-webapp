# Antigram Audience / Market Research Actions

Дата: 2026-07-05

Источник: `/Users/maksimilin/Downloads/Antigram глубинное исследование аудитории, рынка и мультиплатформенного запуска.docx`

## Главный сдвиг в стратегии

Antigram не должен становиться еще одной публичной лентой или BeReal-клоном. Сильнейшая позиция:

`cross-platform cozy analog camera network`

То есть:

- фото как след атмосферы, а не контент ради охвата;
- low-pressure sharing;
- friend graph и малые группы;
- mood graph как язык продукта;
- Telegram-native growth;
- Android/iOS как нативные оболочки над тем же backend;
- монетизация через память, стиль, архив и поддержку, а не через pay-to-boost.

## Что уже закрыто в текущем плане

- Image variants / egress control.
- RLS/storage hardening.
- Stars webhook reliability.
- PostHog event taxonomy.
- Reaction/unread aggregate RPC.
- Search V1: people + public moments.
- Telegram share cards and Mini App links.

## Что нужно поднять в приоритет

### P0 Release Blockers

1. Trust & safety / UGC moderation basics.
   - user blocking;
   - report user/report content;
   - moderation queue;
   - ban state and admin audit trail.

2. Identity architecture.
   - canonical account/profile;
   - future linking: Telegram, Google, Apple, email, phone;
   - avoid duplicate profiles and broken entitlements.

3. Server-owned entitlements.
   - Telegram Stars stays Telegram-only;
   - future Android Premium must use Play Billing;
   - all rights live server-side, not in client flags.

4. Android readiness package.
   - native upload reliability;
   - background/retry queue;
   - Data Safety / Privacy / UGC policy readiness;
   - crash/ANR quality gates.

### P1 Product Differentiation

1. Shared Rolls.
2. Couple / Group Albums.
3. Weekly Contact Sheet / Recap.
4. Mood Channels and Vibe Feed.
5. Invite-to-roll / invite-to-album loops.
6. Soft local/event tags without live maps.

### Monetization Direction

Healthy early monetization:

- premium film packs;
- extra albums/highlights;
- recap customization;
- archive/export;
- private group vaults;
- profile themes;
- Telegram-only Stars tipping.

Avoid early:

- ads inside core feed;
- pay-to-boost;
- Android Stars-like external payment;
- vanity leaderboards.

## Immediate Work Taken From This Research

Start with **user blocking** as the first concrete trust & safety primitive.

Why:

- required direction for UGC policy readiness;
- useful immediately in Telegram Mini App;
- small enough to ship safely;
- later moderation queue and report flows can build on it.

Acceptance criteria:

- authenticated user can block another user;
- blocked user content disappears from feeds/search/profile discovery where practical;
- user can unblock from the other user's profile;
- cannot block yourself;
- RLS protects the block table;
- app works gracefully before/after SQL migration.
