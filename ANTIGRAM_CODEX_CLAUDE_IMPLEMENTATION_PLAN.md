# Antigram Codex / Claude Implementation Plan

Last updated: 2026-07-05

This document turns the July 2026 product research and the current architecture notes into a practical implementation plan for Codex, Claude, and future engineering sessions.

Primary inputs:

- `/Users/maksimilin/Desktop/ANTIGRAM/Исследования/Antigram в июле 2026.docx`
- `/Users/maksimilin/Downloads/Antigram глубинное исследование аудитории, рынка и мультиплатформенного запуска.docx`
- `ANTIGRAM_ARCHITECTURE_DEEP_DIVE.md`
- `CLAUDE.md`

The goal is not to copy every trendy social feature. The goal is to make Antigram the strongest possible version of itself: photo-first, ritual-first, mood-first, cozy-social, Telegram-native, technically solid, and monetizable without ruining trust.

---

## 1. Executive Summary

Antigram already has a strong base:

- Telegram Mini App entry and bot surface;
- React/Vite/TypeScript frontend;
- Supabase Auth/Postgres/Storage backend;
- Edge Functions for Telegram auth, Stars, webhook/onboarding, and support;
- film-style camera/upload flow;
- moods, reactions, comments, follows, profiles, albums, highlights, notifications;
- Telegram Stars creator support scaffold;
- Premium scaffold;
- PostHog analytics.

The July research points to one clear product direction:

Antigram should become a `mood-first film diary inside Telegram`, not another Instagram clone and not a BeReal clone.

The technical direction is equally clear:

Before adding complex social mechanics, Antigram must harden its media pipeline, security model, payment/webhook reliability, server-side aggregation, search/discovery layer, analytics, identity, entitlements, and moderation. After that foundation, the best product bets are Mood Channels, Contact Sheet Profile, Film Roll of the Day, Telegram Share Cards, Weekly Bot Recap, Group/Friend Rolls, Seasonal Film Drops, and Supporter Wall.

The correct order:

1. Reduce media cost and improve speed.
2. Audit RLS/storage/security and Stars reliability.
3. Move fragile client-side aggregation into SQL/RPC surfaces.
4. Expand discovery from profile search to moment/mood search.
5. Add Telegram-native sharing and referral loops.
6. Add trust & safety primitives before wider Android/public launch.
7. Make profile and mood surfaces iconic.
8. Add ritual features like Film Roll of the Day.
9. Add monetization that feels aesthetic and supportive, not extractive.

---

## 2. Product Principles

Use these principles when deciding what to build.

### 2.1 Photo-first, not video-first

Do not pivot Antigram into Reels/TikTok territory. The product promise is atmospheric photo memory, film ritual, mood, and gentle social feedback.

### 2.2 Ritual-first, not feed-first

The feed matters, but it should not become the whole product. The best long-term object may be a `film roll`, not a single isolated post.

### 2.3 Cozy-social, not performance-social

Avoid public vanity pressure, leaderboards, aggressive like metrics, pay-to-boost, and creator pressure. Reactions should feel like warm feedback, not a popularity contest.

### 2.4 Mood-first discovery

Moods should evolve from metadata into real surfaces: Mood Channels, mood subscriptions, mood search, mood recaps, and mood-based profiles.

### 2.5 Telegram-native growth

Growth should use Telegram naturally: bot onboarding, share cards, story sharing, prepared messages, group rolls, recaps, referral attribution, and home-screen prompts. No spammy invite walls.

### 2.6 Monetization as identity and support

Stars, Premium, seasonal films, supporter walls, profile skins, and archive tools should enhance self-expression and support creators. Free users must still have a full core experience.

---

## 3. Current Architecture Facts To Respect

Key files:

- `src/App.tsx`: route tree.
- `src/contexts/AuthContext.tsx`: Telegram auth and Supabase session handling.
- `src/lib/db.ts`: central data access boundary.
- `src/lib/types.ts`: shared domain types.
- `src/lib/analytics.ts`: PostHog tracking wrapper.
- `src/lib/premium.ts`: Premium flags and limits.
- `src/lib/support.ts`: support request client.
- `src/pages/FeedPage.tsx`: home feed and filter behavior.
- `src/pages/SearchPage.tsx`: current search/discovery surface.
- `src/pages/UploadPage.tsx`: camera, film, mood, upload.
- `src/pages/MomentFeedPage.tsx`: fullscreen moment feed.
- `src/pages/MyProfilePage.tsx`: own profile, albums, premium prompt, settings.
- `src/pages/ProfilePage.tsx`: other user profile.
- `src/components/MomentCard.tsx`: feed card behavior.
- `src/components/CategoryFilmStrip.tsx`: mood/category thumbnails.
- `src/components/BottomNav.tsx`: five-tab navigation and film picker.
- `src/components/MiniPlayer.tsx`: global player.
- `supabase/functions/telegram-auth/index.ts`: Telegram initData auth.
- `supabase/functions/create-star-invoice/index.ts`: Stars invoice creation.
- `supabase/functions/telegram-stars-webhook/index.ts`: bot onboarding and Stars webhook.
- `supabase/functions/support-request/index.ts`: support form function.
- `supabase/migrations/*.sql`: schema and policy changes.

Important current constraints:

- There is no separate application backend. Business logic is frontend + Supabase + Edge Functions.
- Keep `src/lib/db.ts` as the main client data access boundary.
- `npm run build` is the main verification command.
- There is currently no dedicated test suite or lint script.
- Telegram Edge Functions may need deployment with `--no-verify-jwt` when called by Telegram or public clients.
- Bot token must stay only in Supabase secrets.
- The app is mobile-first and max-width constrained, so avoid heavy panels and crowded UI.
- Supabase cached egress has already exceeded the free quota. Media strategy is urgent.
- Supabase Storage Image Transformations may require a paid plan, so the plan needs a free-plan fallback.

---

## 4. Priority Thesis

### P0: Foundation Before More Social Complexity

The first implementation wave must reduce operational risk:

1. Image variants and storage strategy.
2. RLS/storage policy audit.
3. Stars webhook hardening.
4. SQL/RPC aggregation for reactions and notifications.
5. Search v1 for moments, moods, albums, and users.
6. PostHog event taxonomy.
7. Telegram share cards with referral attribution.
8. Trust & safety basics: user blocking, report-user flow, moderation queue, admin audit trail.
9. Identity and entitlement foundations for Android/iOS readiness.

### P1: Product Differentiation

After P0 is stable:

1. Mood Channels.
2. Contact Sheet Profile.
3. Soft Reaction Prompts.
4. Weekly Bot Recap.
5. Premium Film Club MVP.
6. Shared / Couple / Group Rolls.
7. Weekly Contact Sheet and recap sharing.

### P2: Signature Bets

After the foundation and core loops are measurable:

1. Film Roll of the Day.
2. Group/Friend Roll.
3. Seasonal Film Drops.
4. Supporter Wall and creator milestones.
5. Hybrid mood search with pgvector.
6. Selective realtime surfaces.

---

## 5. Workstream A: Image Pipeline And Egress Control

### Why This Is First

Antigram is photo-heavy and Supabase cached egress already exceeded the free quota. Feed, profile strips, search grids, albums, and fullscreen views should not all load the same large original image.

### Product Impact

- Faster feed/search/profile screens.
- Lower Supabase egress.
- Better perceived quality inside Telegram WebView.
- Enables Contact Sheet Profile and Mood Channels without huge media cost.

### Technical Direction

Use a two-track approach:

1. Short-term, free-plan compatible: generate and store derivatives at upload/backfill time.
2. Medium-term, if plan supports it: evaluate Supabase Image Transformations + Smart CDN for public derivatives.

Do not depend only on runtime transformations until the Supabase plan and pricing are confirmed.

### Proposed Variant Model

For every public moment:

- `original`: max 1600px longest side, JPEG quality around 0.85, already partly implemented for new uploads.
- `thumb`: 360-480px longest side, grid/profile/search thumbnails.
- `feed`: 900-1080px longest side, feed cards.
- `full`: 1400-1600px longest side, fullscreen moment.

Possible storage paths:

- `moments/originals/{userId}/{momentId}.jpg`
- `moments/variants/{userId}/{momentId}_thumb.jpg`
- `moments/variants/{userId}/{momentId}_feed.jpg`
- `moments/variants/{userId}/{momentId}_full.jpg`

Possible schema:

```sql
alter table moments
  add column if not exists image_variants jsonb not null default '{}'::jsonb;
```

Example JSON:

```json
{
  "original": "...",
  "thumb": "...",
  "feed": "...",
  "full": "..."
}
```

### Implementation Tasks

1. Add a reusable image helper:
   - `src/lib/imageVariants.ts`
   - `getMomentImageUrl(moment, variant)`
   - `getBestAvailableVariant(moment, preferred)`
   - fallback to old `photo_url` or equivalent existing field.

2. Update upload pipeline:
   - `src/pages/UploadPage.tsx`
   - Generate `thumb`, `feed`, and `full` canvases from the processed output.
   - Upload all variants.
   - Save variant URLs in `moments.image_variants`.

3. Update render surfaces:
   - Feed cards use `feed`.
   - Search grid uses `thumb`.
   - CategoryFilmStrip uses `thumb`.
   - Profile film strip uses `thumb`.
   - Profile grid uses `thumb` or `feed` depending tile size.
   - Fullscreen moment feed uses `full`.
   - Album cover uses `thumb`.

4. Add migration:
   - `supabase/migrations/YYYYMMDDHHMM_add_image_variants.sql`

5. Backfill old images:
   - Prefer a local one-off script or Edge Function run with service role.
   - Keep script outside client bundle.
   - Log failed moments and allow retry.

6. Measure:
   - Add PostHog event/property for `image_variant_loaded` only if needed for debugging.
   - Track `image_load_slow` and `image_load_failed`.
   - Watch Supabase cached egress after deploy.

### Acceptance Criteria

- New uploads have at least `thumb`, `feed`, and `full` variants.
- Existing UI falls back gracefully for old moments without variants.
- Search/profile grids no longer load original-sized images.
- `npm run build` passes.
- Manual smoke test: upload, feed, search, profile, moment fullscreen, albums.

### Codex Prompt

```text
Implement image variants for Antigram moments. Add a moments.image_variants jsonb migration, create src/lib/imageVariants.ts, update UploadPage to upload thumb/feed/full derivatives, and update feed/search/profile/moment/albums surfaces to use the correct variant with fallback to the old image URL. Keep changes scoped and run npm run build.
```

---

## 6. Workstream B: RLS, Storage Policies, And Security Audit

### Why This Is P0

Antigram handles user photos, social relationships, notifications, support requests, and paid Stars flows. A social app cannot scale safely with uncertain RLS and storage policies.

### Scope

Audit:

- `profiles`
- `moments`
- `reactions`
- `follows`
- `comments`
- `saved_moments`
- `albums`
- `album_moments`
- `highlights`
- `notifications`
- `premium_subscriptions`
- `reports`
- Stars support tables
- support request tables
- storage buckets and paths
- Edge Function secrets and JWT requirements.

### Policy Principles

- Users can read public content.
- Users can modify only their own profile/content unless they are admin.
- Users cannot modify aggregate/payment fields directly.
- Reports are insert-only for normal users.
- Notifications are readable only by recipient.
- Support requests are visible to owner and admins.
- Stars payment records are never client-writable after creation except via controlled functions.
- Admin actions require admin role checks.

### Implementation Tasks

1. Create an audit document:
   - `ANTIGRAM_SECURITY_RLS_AUDIT.md`
   - list current tables, policies, gaps, recommended migrations.

2. Inspect migrations and live schema if available.

3. Add missing RLS migrations.

4. Add storage bucket policy review:
   - public derivatives may be public-read;
   - originals/private moments require stricter rules;
   - support attachments should be private and signed URL only.

5. Confirm Edge Function setup:
   - `telegram-stars-webhook` webhook route callable by Telegram;
   - `telegram-auth` callable by client;
   - service role only in Edge Functions;
   - no bot token in frontend/Vercel env.

6. Add minimal manual test checklist:
   - anon cannot write social tables;
   - authenticated user cannot update another user moment;
   - authenticated user cannot read another user's private notifications;
   - non-admin cannot shadowban or read support inbox.

### Acceptance Criteria

- Audit document exists.
- Required migrations are added.
- Dangerous client-write surfaces are blocked.
- `npm run build` passes if frontend touched.
- Supabase migration can be pushed or reviewed.

### Codex Prompt

```text
Audit Antigram Supabase RLS and storage policies. Create ANTIGRAM_SECURITY_RLS_AUDIT.md, inspect migrations and table usage in src/lib/db.ts, identify missing policies for social/payment/support tables, and add focused migrations for the highest-risk gaps. Do not refactor unrelated app code.
```

---

## 7. Workstream C: Stars Webhook And Payment Reliability

### Why This Is P0

Monetization cannot be trusted until Stars payments are idempotent, recoverable, auditable, and safe. Entitlements must not be granted before confirmed payment.

### Current Surfaces

- `src/components/StarSupportButton.tsx`
- `src/lib/db.ts`
- `src/lib/premium.ts`
- `src/pages/PremiumPage.tsx`
- `supabase/functions/create-star-invoice/index.ts`
- `supabase/functions/telegram-stars-webhook/index.ts`
- `supabase/migrations/202606280001_star_support.sql`
- `supabase/migrations/202607010003_premium_subscriptions.sql`
- `supabase/migrations/202607010004_premium_daily_frame_limit.sql`

### Implementation Tasks

1. Add/verify payment ledger constraints:
   - unique `telegram_payment_charge_id`;
   - unique idempotency key where possible;
   - status lifecycle: `invoice_created`, `pre_checkout_seen`, `paid`, `refunded`, `failed`.

2. Harden webhook:
   - handle duplicate updates;
   - handle retries;
   - never grant support/premium on `pre_checkout_query`;
   - grant only on `successful_payment`;
   - log unknown payloads safely.

3. Add reconciliation view/admin query:
   - invoices without payments;
   - payments without granted entitlement;
   - duplicate webhook attempts;
   - failed author notifications.

4. Add author notification reliability:
   - if Telegram API notify fails, record failure for retry.

5. Add Premium production gate:
   - keep `PREMIUM_ENABLED` false until webhook and entitlement checks pass.

### Acceptance Criteria

- Duplicate Telegram payment updates are safe.
- Entitlements/support records are created exactly once.
- Payment failures are visible.
- Premium cannot silently activate from an untrusted client path.

### Codex Prompt

```text
Harden Telegram Stars payment handling in Antigram. Review create-star-invoice, telegram-stars-webhook, star support and premium migrations. Add idempotency constraints and webhook duplicate handling, ensure entitlements are granted only on successful_payment, and document reconciliation/admin checks.
```

---

## 8. Workstream D: SQL/RPC Aggregation For Reactions And Notifications

### Why This Matters

The app currently calculates or fetches reaction and notification data in multiple client flows. As feed/search/profile scale, client-side aggregation becomes slow and inconsistent.

### Target Architecture

Move common aggregate reads into Postgres views/RPC:

- reaction counts per moment;
- current user's reaction per moment;
- top reaction per moment;
- unread notification count;
- star totals per moment/profile;
- maybe profile counters.

### Implementation Tasks

1. Add SQL view or RPC:
   - `get_moment_reaction_summaries(moment_ids uuid[])`
   - returns `moment_id`, counts by type, top type, top count, current user reaction optional.

2. Add notification RPC:
   - `get_unread_notification_count()`
   - uses `auth.uid()`.

3. Update `src/lib/db.ts`:
   - route feed/profile/search calls through new aggregate functions.

4. Update UI:
   - `MomentCard`
   - `FeedPage`
   - `MomentFeedPage`
   - `ProfilePage`
   - `MyProfilePage`
   - `SearchPage`

5. Preserve optimistic reaction UX.

### Acceptance Criteria

- Reaction counts are consistent across feed/search/profile/fullscreen.
- My reaction does not render duplicate pills.
- Notification badge updates after mark-read.
- Fewer repeated queries for the same moment set.

### Codex Prompt

```text
Move Antigram reaction and notification aggregate reads into SQL/RPC. Add migrations for reaction summary and unread notification RPCs, update src/lib/db.ts, and update feed/search/profile/moment surfaces to use the shared aggregate contract while preserving optimistic reaction behavior.
```

---

## 9. Workstream E: Search V1 And Mood Channels

### Why This Is High Leverage

Search currently over-indexes on users. The research says Antigram's differentiation is mood discovery: users should browse feelings, not just accounts.

### Product Shape

Search should become:

- People
- Moments
- Moods
- Albums
- Channels

Mood Channels are curated/generated surfaces such as:

- Calm
- Warm Evening
- Nostalgic
- After Rain
- Late Metro
- Soft Chaos
- First Snow

### MVP Technical Plan

1. Add FTS over moments:
   - caption;
   - emotion/mood;
   - custom mood label;
   - author username/name.

2. Add FTS over albums:
   - title;
   - owner display name.

3. Add `mood_channels` table:

```sql
create table mood_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  emoji text,
  query text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

4. Add RPC:
   - `search_antigram(query text, limit_count int)`
   - or separate `search_public_moments`, `search_albums`, `search_profiles`.

5. Add route:
   - `/moods/:slug` or `/search/moods/:slug`.

6. Update `src/pages/SearchPage.tsx`:
   - tabs or segmented control;
   - mood channel cards;
   - moment grid results;
   - user results still available.

7. Use image variants from Workstream A.

### Advanced Plan

Later:

- pgvector embeddings for captions/moods/images;
- hybrid FTS + vector score;
- mood subscription table;
- personalized mood channel ranking.

### Acceptance Criteria

- Searching "warm", "calm", "street", usernames, captions, and custom moods returns useful content.
- Mood channel pages work from Search.
- Empty states are warm and short.
- No heavy infinite-scroll pressure.

### Codex Prompt

```text
Build Search V1 and Mood Channels for Antigram. Add Postgres FTS/RPC migrations for public moments/albums/users, add a mood_channels table with seed channels, update src/lib/db.ts, and redesign SearchPage around People, Moments, Moods, and Albums. Use thumbnail variants when available.
```

---

## 10. Workstream F: Telegram Share Cards And Referral Attribution

### Why This Is P0 Growth

Telegram is Antigram's distribution layer. The app should not rely only on users manually opening the bot. After posting or reacting, users should be able to share a beautiful Antigram card into chats/stories with attribution.

### Product Mechanics

1. After first post:
   - show one subtle share sheet prompt.
   - "Send this frame to a friend" / "Share to Story".

2. On every moment:
   - share button in menu.
   - prepared card with photo/mood/author.

3. Referral link:
   - `startapp=ref_{code}` or route parameter.
   - attribute invited opens and first posts.

4. Weekly recap:
   - later, bot can send "your week on film" contact sheet.

### Technical Tasks

1. Add referral fields:
   - `profiles.referral_code`
   - `referrals` table with inviter/invitee/opened/first_post_at.

2. Parse start params:
   - in Telegram auth/client bootstrap;
   - store attribution before/after user profile creation.

3. Add share helpers:
   - `src/lib/telegramShare.ts`
   - wrap `shareMessage`, `shareToStory`, `openTelegramLink`, fallback copy link.

4. Add share card UI:
   - `src/components/ShareMomentSheet.tsx`
   - use existing moment data and thumbnail/full variant.

5. Add bot support:
   - `telegram-stars-webhook` can respond to referral/entry commands if needed.

6. Add analytics:
   - `share_card_opened`
   - `share_card_sent`
   - `story_share_opened`
   - `invite_friend_opened`
   - `friend_first_post_attributed`

### Acceptance Criteria

- Sharing works inside Telegram and degrades outside Telegram.
- Referral attribution can connect inviter and invitee.
- No spammy forced invite wall.
- PostHog tracks share funnel.

### Codex Prompt

```text
Implement Telegram-native share cards and referral attribution for Antigram. Add referral_code/referrals migration, parse Telegram start params, create a telegramShare helper with shareMessage/shareToStory fallbacks, add a subtle share sheet after posting and in moment menus, and track share/referral events in PostHog.
```

---

## 11. Workstream G: PostHog Event Taxonomy And Funnels

### Why This Matters

Before major product bets, Antigram needs consistent measurement. Current analytics helpers exist but event names should be aligned with the July research.

### Required Events

Activation:

- `miniapp_opened`
- `telegram_auth_started`
- `telegram_auth_succeeded`
- `profile_created`
- `first_moment_started`
- `first_moment_posted`

Creation:

- `upload_started`
- `film_selected`
- `camera_capture_taken`
- `mood_selected`
- `moment_posted`
- `upload_failed`

Engagement:

- `reaction_sent`
- `comment_posted`
- `moment_saved`
- `profile_followed`
- `profile_opened`
- `album_opened`

Discovery:

- `search_submitted`
- `search_result_opened`
- `mood_channel_opened`
- `mood_channel_followed`

Growth:

- `share_card_opened`
- `share_card_sent`
- `story_share_opened`
- `invite_friend_opened`
- `friend_first_post_attributed`

Monetization:

- `stars_invoice_created`
- `stars_payment_succeeded`
- `premium_page_viewed`
- `premium_started`
- `premium_activated`

Trust:

- `report_submitted`
- `support_request_submitted`
- `image_load_slow`
- `safe_area_fallback_used`

### Implementation Tasks

1. Expand `src/lib/analytics.ts` with named helpers.
2. Replace older event names gradually or keep aliases briefly.
3. Add funnel document:
   - `ANTIGRAM_ANALYTICS_PLAN.md`
4. Do not log PII or raw Telegram initData.

### Acceptance Criteria

- Event names are consistent.
- Core activation funnel can be built.
- Creation and share funnels can be built.
- Payment funnel can be built.

---

## 12. Workstream H: Contact Sheet Profile

### Why It Fits Antigram

This is one of the most on-brand ideas from the research. Profiles should feel like photographic archives, not generic grids.

### MVP

1. Group profile moments by week/month into rolls.
2. Show pinned highlights as the top film strip.
3. Add "Contact sheet" mode for own and other profiles.
4. Use `thumb` variants.
5. Keep "My frames" and "My albums", but make the profile identity stronger.

### Advanced

- Editable zine layout.
- Seasonal profile skins.
- Supporter wall.
- Emotional palette: most-used moods/reactions.
- Public/private rolls.

### Technical Tasks

1. Add helpers:
   - `src/lib/rolls.ts`
   - group by day/week/month.

2. Update profile pages:
   - `src/pages/MyProfilePage.tsx`
   - `src/pages/ProfilePage.tsx`

3. Possibly add DB model later:
   - `rolls`
   - `roll_moments`

For MVP, derive rolls from existing `moments.created_at` to avoid schema complexity.

### Acceptance Criteria

- Profile immediately feels more distinct from Instagram.
- Existing highlights/albums still work.
- No extra heavy image loading.

---

## 13. Workstream I: Soft Reactions And Reaction Prompts

### Why It Fits Antigram

Reactions are already central. The next step is not more emoji, but better prompts and consistent behavior.

### MVP

After a reaction:

- optional prompt: "save this mood", "send a warm reply", "shoot something similar";
- batch reaction notifications;
- consistent reaction pill behavior across Feed, Search, Profile, Moment Feed.

### Technical Tasks

1. Centralize reaction UI behavior:
   - `src/components/ReactionBar.tsx`
   - `src/components/MomentCard.tsx`
   - `src/pages/MomentFeedPage.tsx`
   - profile/search preview pills.

2. Add notification batching logic:
   - SQL/RPC or Edge job later.

3. Add analytics:
   - `reaction_sent`
   - `reaction_prompt_clicked`

### Acceptance Criteria

- No duplicate reaction UI.
- Direct reaction in Search/collections remains.
- Reaction prompt never blocks scrolling.

---

## 14. Workstream J: Moderation Queue And Admin Tooling

### Why This Is Required

A public photo-social app needs trust/safety before growth. `reports` exist, but reporting without review workflow is incomplete.

### MVP

1. Add report status:
   - `open`
   - `reviewing`
   - `resolved`
   - `rejected`

2. Add moment moderation fields:
   - `is_hidden`
   - `hidden_reason`
   - `hidden_at`
   - `hidden_by`

3. Add admin review UI:
   - maybe inside existing support/admin sheet first.
   - show reported moment, reporter, reason, actions.

4. Admin actions:
   - hide moment;
   - unhide moment;
   - shadowban user;
   - dismiss report.

### Advanced

- AI-assisted NSFW/abuse detection.
- User block/mute.
- Appeal flow.
- Admin audit log.

### Acceptance Criteria

- Users can report harmful content.
- Admin can review and hide content.
- Hidden content disappears from public feeds/search/profile.
- Actions are protected by admin role.

---

## 15. Workstream K: Film Roll Of The Day

### Why It Is The Biggest Product Bet

This is the feature that can make Antigram feel like a ritual, without copying BeReal's strict daily pressure.

### MVP

1. One recommended roll per day.
2. User can add 1 frame with selected film and mood.
3. After posting, show soft share card.
4. Roll appears in profile contact sheet.

### V2

1. 3-5 frames per day.
2. One selected film per roll.
3. Optional delayed reveal.
4. Weekly bot recap.
5. Friend/group roll.

### Data Model

Possible MVP schema:

```sql
create table daily_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  roll_date date not null,
  film_id text,
  mood text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(user_id, roll_date)
);

alter table moments
  add column if not exists daily_roll_id uuid references daily_rolls(id) on delete set null;
```

### UI Surfaces

- Feed: "Today's roll" entry card.
- Upload: attach current daily roll.
- Profile: contact sheet rolls.
- Bot: weekly recap later.

### Acceptance Criteria

- The feature feels optional and warm.
- No punitive streaks.
- A user can still post normal moments.

---

## 16. Workstream L: Premium Film Club And Seasonal Drops

### Why It Is Good Monetization

The research recommends monetization through identity, aesthetics, archive, and creator support. That fits Antigram better than ads or boosts.

### MVP Premium Film Club

Possible benefits:

- more daily frames;
- more profile highlights;
- rare film presets;
- seasonal profile skins;
- extra archive/contact-sheet layouts;
- longer private archive;
- early access.

Keep basic creation, feed, search, reactions, and profile usable for free users.

### Seasonal Drops

Examples:

- "Summer Heat 2026" film;
- "After Rain" film;
- "Night Metro" frame pack;
- limited contact-sheet skin.

### Technical Tasks

1. Extend catalog:
   - `premium_features`
   - `film_drops`
   - `user_entitlements`

2. Keep Stars as primary in-Telegram payment rail.

3. Enforce entitlements in:
   - upload film selection;
   - profile customization;
   - daily limits;
   - highlights limit.

4. Add UI:
   - `src/pages/PremiumPage.tsx`
   - profile compact premium prompt;
   - film picker badges.

### Acceptance Criteria

- Monetization feels like collecting beautiful tools, not losing basic app access.
- Entitlements are granted server-side only.
- Premium remains disabled until payment hardening is done.

---

## 17. Workstream M: Weekly Bot Recap

### Why It Fits Telegram

The bot should become a useful companion, not just an entry button. Weekly recaps can bring users back to their archive and friends without spam.

### MVP

1. Generate text recap:
   - number of frames;
   - top mood;
   - top reaction;
   - invite to open app.

2. Send only to users who opted in or recently used the app.

3. Include inline Mini App button.

### V2

- Contact sheet image generation.
- Friend roll prompts.
- Supporter milestones.

### Technical Tasks

1. Add user notification preferences.
2. Add Edge Function or scheduled job strategy.
3. Add bot message templates ru/en.
4. Add analytics for recap CTR.

### Acceptance Criteria

- No spammy bot behavior.
- User can opt out.
- Message opens the app directly.

---

## 18. Workstream N: Auth And Identity Linking

### Why It Matters

Current dual Telegram/web auth is useful, but identities can drift if Telegram and email accounts are not linked carefully.

### MVP

1. Add email OTP for standalone web instead of password-heavy UX.
2. Add identity linking flow from profile/settings.
3. Clearly show current login method.

### Technical Tasks

- `src/contexts/AuthContext.tsx`
- `src/pages/AuthPage.tsx`
- Supabase Auth settings
- profile settings UI

### Acceptance Criteria

- Telegram users can optionally add email.
- Web users can connect Telegram.
- No duplicate profile confusion.

---

## 19. Workstream O: Hybrid Mood Search With pgvector

### When To Do It

Only after FTS Mood Channels are shipped and measured.

### Why

Pinterest-like vibe discovery is a major trend. Antigram can eventually support "find photos that feel like this".

### MVP Later

1. Store text embeddings for captions/custom moods.
2. Optionally image embeddings later.
3. RPC for hybrid score:
   - FTS score;
   - vector similarity;
   - freshness;
   - diversity;
   - reaction affinity.

### Do Not Do Yet

- Do not add external search vendor first.
- Do not build complex recommendation infrastructure before basic FTS and metrics.

---

## 20. Phase Roadmap

### Phase 0: Documentation And Safety Prep

Duration: 1-2 days.

Tasks:

- Keep `ANTIGRAM_ARCHITECTURE_DEEP_DIVE.md` updated.
- Keep this implementation plan updated.
- Create `ANTIGRAM_SECURITY_RLS_AUDIT.md`.
- Decide naming: Antigram remains canonical unless renamed.

Output:

- shared docs ready for Codex/Claude.

### Phase 1: P0 Technical Foundation

Duration: 1-2 weeks.

Tasks:

1. Image variants and derivative URLs.
2. RLS/storage audit and highest-risk fixes.
3. Stars webhook idempotency/recovery.
4. PostHog event taxonomy cleanup.
5. Reaction/unread aggregate RPCs.

Expected effect:

- lower image egress;
- faster app;
- safer social/payment data;
- more reliable analytics;
- cleaner data contracts.

### Phase 2: Discovery And Growth MVP

Duration: 2-4 weeks.

Tasks:

1. Search V1 for moments/moods/albums/users.
2. Mood Channels MVP.
3. Telegram share cards.
4. Referral attribution.
5. First-post share prompt.

Expected effect:

- better session depth;
- more organic Telegram sharing;
- stronger product identity.

### Phase 3: Identity And Trust

Duration: 3-5 weeks.

Tasks:

1. Contact Sheet Profile.
2. Soft Reaction Prompts.
3. Moderation queue/admin UI.
4. Email OTP/identity linking.

Expected effect:

- profile becomes iconic;
- reactions become warmer;
- launch readiness improves.

### Phase 4: Ritual And Monetization

Duration: 4-8 weeks.

Tasks:

1. Film Roll of the Day MVP.
2. Weekly Bot Recap.
3. Premium Film Club MVP.
4. Seasonal Film Drops MVP.
5. Supporter Wall MVP.

Expected effect:

- habit loop;
- creator/user support;
- non-toxic monetization.

### Phase 5: Advanced Differentiation

Duration: 2-4 months.

Tasks:

1. Group/Friend Roll.
2. Hybrid Mood Search with pgvector.
3. Selective realtime surfaces.
4. AI-assisted mood tagging and moderation assistance.
5. Cloudflare Images experiment only if Supabase economics require it.

Expected effect:

- stronger viral/cozy loops;
- modern discovery;
- scalable personalization.

---

## 21. Suggested Task Order For Codex Sessions

Use small, verifiable sessions. Avoid giant mixed PRs.

### Task 1

Image variants MVP.

Files:

- `supabase/migrations/*_add_image_variants.sql`
- `src/lib/imageVariants.ts`
- `src/pages/UploadPage.tsx`
- `src/components/MomentCard.tsx`
- `src/pages/FeedPage.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/MomentFeedPage.tsx`
- `src/pages/MyProfilePage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/components/CategoryFilmStrip.tsx`

Verify:

- `npm run build`
- manual upload/feed/search/profile/fullscreen.

### Task 2

Security/RLS audit doc plus urgent migrations.

Files:

- `ANTIGRAM_SECURITY_RLS_AUDIT.md`
- `supabase/migrations/*.sql`
- maybe Edge Function docs.

Verify:

- migration review;
- manual policy checklist.

### Task 3

Stars webhook hardening.

Files:

- `supabase/functions/create-star-invoice/index.ts`
- `supabase/functions/telegram-stars-webhook/index.ts`
- `supabase/migrations/*_stars_idempotency.sql`
- `src/lib/db.ts`

Verify:

- Edge Function build/deploy if needed;
- duplicate webhook simulation if possible.

### Task 4

Analytics taxonomy.

Files:

- `src/lib/analytics.ts`
- core pages/components using events;
- `ANTIGRAM_ANALYTICS_PLAN.md`

Verify:

- `npm run build`
- PostHog events visible locally/prod if configured.

### Task 5

Reaction and notification aggregate RPCs.

Files:

- `supabase/migrations/*_reaction_notification_aggregates.sql`
- `src/lib/db.ts`
- feed/search/profile/moment files.

Verify:

- `npm run build`
- reaction behavior across surfaces.

### Task 6

Search V1 and Mood Channels.

Files:

- `supabase/migrations/*_search_mood_channels.sql`
- `src/lib/db.ts`
- `src/pages/SearchPage.tsx`
- optional new route/page.

Verify:

- search for captions, moods, users, albums.

### Task 7

Telegram Share Cards and referrals.

Files:

- `src/lib/telegramShare.ts`
- `src/components/ShareMomentSheet.tsx`
- `src/pages/UploadPage.tsx`
- `src/pages/MomentFeedPage.tsx`
- `supabase/functions/telegram-stars-webhook/index.ts`
- migration for referrals.

Verify:

- in Telegram WebView and standalone fallback.

### Task 8

Contact Sheet Profile.

Files:

- `src/lib/rolls.ts`
- `src/pages/MyProfilePage.tsx`
- `src/pages/ProfilePage.tsx`
- maybe `src/components/ContactSheet.tsx`

Verify:

- old profile data renders;
- no heavy original image loading.

### Task 9

Moderation queue/admin.

Files:

- `supabase/migrations/*_moderation_queue.sql`
- `src/lib/db.ts`
- `src/pages/MyProfilePage.tsx` or dedicated admin page.

Verify:

- report, review, hide, unhide, permissions.

### Task 10

Film Roll of the Day MVP.

Files:

- `supabase/migrations/*_daily_rolls.sql`
- `src/lib/db.ts`
- `src/pages/UploadPage.tsx`
- `src/pages/FeedPage.tsx`
- profile pages.

Verify:

- create today's roll;
- attach moment;
- show in profile/contact sheet.

---

## 22. Claude Roles

Claude is useful for:

- reviewing product trade-offs;
- writing UX copy in Russian/English;
- checking whether features stay "cozy" and not generic;
- doing RLS/security review from a second perspective;
- creating prompt briefs for individual Codex sessions;
- reviewing implementation plans before code.

Suggested Claude prompts:

### Product Review Prompt

```text
Read ANTIGRAM_CODEX_CLAUDE_IMPLEMENTATION_PLAN.md, ANTIGRAM_ARCHITECTURE_DEEP_DIVE.md, and the July 2026 research. Review whether the next planned feature keeps Antigram photo-first, mood-first, cozy-social, and Telegram-native. Flag anything that feels like a generic Instagram/TikTok clone.
```

### Security Review Prompt

```text
Review the planned Supabase RLS/storage/payment changes for Antigram. Focus on moments, reactions, notifications, reports, Stars payments, support requests, and admin actions. Identify policies or client-write paths that could leak or corrupt user/payment data.
```

### UX Copy Prompt

```text
Create short Russian and English UI copy for the Antigram feature described below. The tone should be warm, quiet, film-like, and not salesy. Avoid long explanations and avoid pressure.
```

---

## 23. Anti-Roadmap

Do not do these now:

- video-first pivot;
- Reels/TikTok-style endless aggressive feed;
- public creator leaderboards;
- pay-to-boost through Stars;
- invite walls;
- too many reaction types;
- generic AI image generation as a core feature;
- external recommendation/search vendor before Postgres FTS/pgvector;
- separate backend service before Supabase is actually exhausted;
- heavy UI panels inside Telegram WebView;
- monetization that weakens the free core.

---

## 24. Open Decisions

Need owner/user decision before implementation:

1. Should public moment derivatives be publicly cacheable?
2. Should originals remain private/signed or public?
3. Will Supabase be upgraded to Pro for transformations/egress, or do we rely on generated derivatives first?
4. What is the canonical product name: Antigram, Fungram, or another final name?
5. Which markets/languages matter first besides Russian/English?
6. Should Film Roll of the Day be optional only, or become the default posting object?
7. Should Premium be launched before or after Film Roll?
8. What moderation/admin access model should be used?
9. Which analytics events are must-have before growth experiments?
10. What is the acceptable monthly infrastructure budget?

---

## 25. Definition Of Done For Each Implementation Session

Every Codex/Claude implementation session should end with:

- concise summary of files changed;
- migration names if any;
- Edge Functions deployed or not deployed;
- `npm run build` result if frontend touched;
- Supabase deploy/push status if backend touched;
- known follow-ups;
- whether changes were committed/pushed.

For code changes:

- keep edits scoped;
- do not rewrite unrelated UI;
- preserve existing Telegram Mini App constraints;
- preserve random public fallback in Feed;
- preserve direct reaction in Search/collections;
- preserve bot onboarding behavior;
- do not expose secrets to frontend;
- update docs if behavior changes.

---

## 26. One-Line North Star

Weekly Meaningful Photo Connections: unique weekly moments where a photo creates a warm social response through reaction, save, comment, follow, tip, share, or roll participation.

This is better than raw DAU or posts/day because Antigram is not about maximum content volume. It is about meaningful visual-emotional connection.
