# ANTIGRAM TELEGRAM MINI APP — CLAUDE.md

## What is this project?

Antigram is a photo-sharing social network embedded as a **Telegram Mini App** (TMA). Users shoot or upload photos, optionally apply analog film-stock LUT filters (Kodak, Fujifilm, AGFA, etc.), add mood/emotion tags, and share them as "Moments." Friends follow each other, react with emotion categories (warm / nostalgic / calm / wow / relatable), and support creators with **Telegram Stars** (in-app microtransactions). There is also an optional background music player that plays lo-fi tracks as users scroll.

The app is a Vite + React SPA deployed on Vercel that opens inside Telegram's WebView via a bot. It can also be opened as a standalone web app (email/password auth path works outside Telegram).

## Vision & Core Concept

Antigram's brand aesthetic is analog film — amber/brown color palette, JetBrains Mono typeface, film-strip UI components, and real `.cube` LUT files for filter presets. The central button in the nav is labeled `[A]` (the brand mark). Moments can be tagged with one of five emotional moods, and the Explore page categorizes content by those moods. There is a premium subscription layer built in for removing the daily upload frame limit.

## Tech Stack

- **Framework**: React 18.3 + Vite 5, TypeScript 5.6
- **Routing**: React Router v6 (`BrowserRouter`, client-side routing)
- **Styling**: Tailwind CSS 3.4 + CSS variables (dark amber theme)
- **Auth / DB**: Supabase (`@supabase/supabase-js` 2.45) — Postgres + Auth + Storage
- **Telegram SDK**: `@telegram-apps/sdk` v2.9 and `@telegram-apps/sdk-react` v2.0
- **Analytics**: PostHog (via `VITE_POSTHOG_KEY`)
- **Font**: JetBrains Mono via `@fontsource/jetbrains-mono`
- **No backend server** — all server-side logic lives in Supabase Edge Functions

## Project Structure

```
telegram-webapp/
├── src/
│   ├── App.tsx                    — router, routes, BottomNav + MiniPlayer mount logic
│   ├── main.tsx                   — entry point, AuthProvider + LanguageProvider wrapping
│   ├── pages/
│   │   ├── FeedPage.tsx           — personal feed (follows), emotion filter, Star totals
│   │   ├── ExplorePage.tsx        — global/random feed, same emotion filter
│   │   ├── SearchPage.tsx         — user search by username/display_name
│   │   ├── UploadPage.tsx         — camera capture + LUT filter processing + upload + mood tag
│   │   ├── MomentPage.tsx         — single moment view: reactions, comments, Stars
│   │   ├── MomentFeedPage.tsx     — full-screen vertical scroll (Instagram Reels-style)
│   │   ├── AlbumDetailPage.tsx    — album contents
│   │   ├── ProfilePage.tsx        — another user's profile (follow/unfollow, moments, albums)
│   │   ├── MyProfilePage.tsx      — own profile (highlights, albums, edit, saved)
│   │   ├── FollowListPage.tsx     — followers / following list (/me/followers, /me/following)
│   │   ├── NotificationsPage.tsx  — activity notifications
│   │   ├── AuthPage.tsx           — email sign in / sign up (non-Telegram path)
│   │   ├── PremiumPage.tsx        — premium subscription (Telegram Stars payment)
│   │   ├── PrivacyPage.tsx        — privacy policy
│   │   └── TermsPage.tsx          — terms of service
│   ├── components/
│   │   ├── BottomNav.tsx          — 5-tab nav bar with film picker bottom sheet
│   │   ├── MiniPlayer.tsx         — sticky background music player
│   │   ├── MomentCard.tsx         — reusable card used in feed, explore, profile
│   │   ├── CategoryFilmStrip.tsx  — horizontal emotion-category strip at top of Feed/Explore
│   │   ├── Avatar.tsx             — user avatar with fallback initials
│   │   ├── FilmStripHeader.tsx    — film-strip-style header image strip
│   │   ├── ReactionBar.tsx        — emotion reaction picker
│   │   ├── StarSupportButton.tsx  — Telegram Stars tip button
│   │   ├── EmotionFilter.tsx      — emotion tag selector
│   │   └── Skeleton.tsx           — loading placeholders
│   ├── contexts/
│   │   ├── AuthContext.tsx        — Supabase session + Telegram initData auth + profile
│   │   ├── LanguageContext.tsx    — i18n (ru/en), `t()` helper, `formatRelativeTime()`
│   │   └── PlayerContext.tsx      — background music state (track list, play/pause)
│   ├── hooks/
│   │   └── useTelegramSafeArea.ts — reads tg.safeAreaInset.top with fallback
│   └── lib/
│       ├── db.ts                  — all Supabase queries (see Database section)
│       ├── supabase.ts            — Supabase client init
│       ├── types.ts               — shared TS types (Profile, Moment, ReactionType, etc.)
│       ├── filmPresets.ts         — LUT filter presets list
│       ├── premium.ts             — daily frame limit constants
│       ├── analytics.ts           — PostHog wrappers
│       └── support.ts             — Telegram Stars support logic
```

## How to Run Locally

```bash
cd telegram-webapp
npm install
# create .env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_POSTHOG_KEY
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # tsc && vite build → dist/
npm run preview
```

For Telegram-specific features (initData auth, safe areas, Stars payments, haptic feedback), the app must run inside Telegram's WebView — point a bot's Mini App URL at a deployed/tunneled instance (e.g. ngrok). In standalone browser mode only email/password auth is available.

## Architecture & Key Decisions

### Dual auth: Telegram vs. standalone email

`AuthContext.tsx` detects the Telegram context by checking `window.Telegram.WebApp.initData`:

1. **Telegram path**: if `initData` is non-empty → calls the Supabase Edge Function `telegram-auth` with the raw `initData` → Edge Function verifies the HMAC signature with `TELEGRAM_BOT_TOKEN`, upserts a `profiles` row, issues a Supabase JWT → back in the app, `supabase.auth.setSession(accessToken, refreshToken)` is called. Telegram avatar URL is silently synced to the profile in the background.
2. **Standalone path**: if no `initData` → user sees `AuthPage.tsx` with email/password sign-in or sign-up.

### Safe area handling

`useTelegramSafeArea.ts` reads `window.Telegram.WebApp.safeAreaInset.top`. If not available (e.g. non-Telegram browser), it falls back to 48px if a header color is set, otherwise 0. Unlike what older documentation may describe, there is no `contentSafeAreaInset` in use in this version — only `safeAreaInset`.

### Bottom navigation — 5 tabs

`BottomNav.tsx` has fixed positioning at the bottom, `height: 85px`, padding respects `env(safe-area-inset-bottom, 20px)`:

| Position | Route | Icon |
|---|---|---|
| 1 | `/` | Home (feed) |
| 2 | `/search` | Search |
| 3 | `/upload` | `[A]` center FAB — opens film-picker bottom sheet |
| 4 | `/notifications` | Bell (with unread dot) |
| 5 | `/me` | Person (own profile) |

Tapping `[A]` opens a film-picker bottom sheet instead of navigating directly. The user selects a film preset (or "no filter"), then is navigated to `/upload` with the selected `filmId` passed via `location.state`.

The nav is hidden on `/upload`, `/moment-feed`, and `/album/*` routes. The MiniPlayer is hidden on `/auth` and routes that hide the nav.

### Film/LUT filter processing

`UploadPage.tsx` applies `.cube` LUT files client-side via Canvas 2D API — the grain/flare/color pipeline processes the raw camera or gallery image entirely in the browser before uploading to Supabase Storage.

### Telegram Stars

`StarSupportButton.tsx` and `lib/support.ts` integrate Telegram Stars microtransactions. The Edge Function `create-star-invoice` creates a Telegram invoice link. Totals are stored in Supabase views `moment_star_totals` and `profile_star_totals`.

## Database / Backend

All database access goes through `src/lib/db.ts`. No self-hosted backend — Supabase handles everything.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles: `username`, `display_name`, `avatar_url`, `is_banned`, `is_premium` |
| `moments` | Posted photos: `user_id`, `photo_url`, `mood` (emotion tag), `is_public`, `created_at` |
| `reactions` | Unique per (user, moment): `type` = one of `warm / nostalgic / calm / wow / relatable` |
| `follows` | `follower_id` → `following_id` edges |
| `comments` | Text comments on moments |
| `saved_moments` | User's saved/bookmarked moments |
| `albums` | Named collections owned by a user |
| `album_moments` | Many-to-many join: which moments are in which albums |
| `highlights` | Up to N pinned moments shown at top of a user's profile (by `position`) |
| `notifications` | Activity feed: `type`, `actor_id`, `moment_id`, `read` flag |
| `premium_subscriptions` | Active premium subs with `status` and `expires_at` |
| `reports` | Content reports from users |
| `moment_star_totals` | Materialized/view of total Stars received per moment |
| `profile_star_totals` | Materialized/view of total Stars received per profile |

### Edge Functions (Supabase)

- `telegram-auth/index.ts` — validates Telegram initData HMAC, creates/upserts Supabase user, returns JWT session tokens
- `create-star-invoice` — creates a Telegram Stars invoice (invoked via `supabase.functions.invoke`)

## Key Features Implemented

- Full Telegram Mini App integration: initData auth, safeArea, haptic feedback wiring
- Standalone email/password auth fallback
- Moment upload with LUT film filter processing (Canvas, `.cube` files), mood tagging, public/private toggle
- Personal feed (follows-based), Explore feed (global, emotion-filtered), full-screen scroll view
- Reactions (5 emotion types) with optimistic UI
- Comments on moments
- Albums: create, add/remove moments, view album detail page
- Highlights: pin up to N moments to the top of your profile
- Follow/unfollow users
- Saved moments (bookmarks)
- Telegram Stars tip support (invoice creation + totals)
- Premium subscription (daily frame limit lifted for subscribers)
- Notifications center with unread count badge in nav
- Background music player (7 lo-fi tracks, previous/next, mute, lazy loading)
- Language context with Russian/English string switching (`useLanguage` + `t()`)
- PostHog analytics (session tracking, photo posted, filter applied events)
- Admin: shadow ban / unban via `adminShadowBanUser` / `adminUnbanUser` in `db.ts`
- Content reporting via `reportMoment`

## Known Issues / Not Yet Implemented

- `useTelegramSafeArea.ts` reads only `safeAreaInset`, not `contentSafeAreaInset` — some earlier docs or prompt files mention `tg.contentSafeAreaInset.top + tg.safeAreaInset.top` but this is not what the current hook does; do not rely on those older descriptions.
- The `MiniPlayer` persists across routes but its state (current track, play/pause) is managed in `PlayerContext`; the player renders globally in `App.tsx` and the music auto-starts when tracks are loaded — browser autoplay policies may suppress audio until the user interacts.
- `PremiumPage.tsx` — the Stars-based subscription flow exists but the exact payment callback handling (webhook or polling) should be verified against the deployed Edge Function before relying on it.
- No offline mode or service worker.
- No image content moderation (reports go to a table but there is no admin review UI in this codebase).
- The `SearchPage` searches only `profiles`, not moments/content.

## Business Context

- Antigram is positioned as an analog-aesthetic alternative to Instagram, embedded in Telegram's ecosystem. The Telegram distribution channel (sharing via bots, channels, direct links) is the primary acquisition path.
- Monetization: Telegram Stars (direct creator tipping), premium subscription (removes upload limits).
- The ANTIGRAM_PRD and AUDIT_REPORT documents at `../` describe the broader product vision and a June 2026 audit of readiness.

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_POSTHOG_KEY` | PostHog analytics key |

The Edge Function `telegram-auth` requires `TELEGRAM_BOT_TOKEN` as a Supabase secret (set via Supabase CLI, not in this repo's `.env`).

## Deployment

- **Frontend**: Vercel. Standard Vite SPA — `npm run build` → `dist/`, deploy with SPA rewrite rules.
- **Auth Edge Function**: `supabase/functions/telegram-auth/index.ts` — deployed via Supabase CLI (`supabase functions deploy telegram-auth`).
- The Telegram bot must be configured with a Mini App URL pointing at the deployed Vercel domain.

## Restored Operational Notes for Claude/Codex

These notes were restored from the previous `CLAUDE.md` because they are easy to lose during broad documentation rewrites. Re-check them periodically against the current codebase, especially before changing auth, Telegram Mini App behavior, feeds, payments, or deployment.

- `npm run build` is the main local verification command. There is no separate test suite or lint script in this repo right now, and TypeScript is strict enough that unused imports/locals can fail the build.
- For Telegram-specific APIs (`window.Telegram.WebApp`, safe areas, BackButton, HapticFeedback, theme variables, platform quirks), read `TG_MINIAPP_REFERENCE.md` before writing new Telegram WebApp code.
- Supabase Edge Functions that are called directly by Telegram or public clients may need `--no-verify-jwt` when deployed. This is especially important for webhook-style functions because Telegram does not send a Supabase JWT.
- Never add `VITE_TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN`, or `BOT_TOKEN` to Vercel or any client-side env. Bot tokens belong only in Supabase Edge Function secrets.
- `FeedPage` and `ExplorePage` intentionally differ in category thumbnail scope: the feed uses following-scoped thumbnails, while Explore/Search-style surfaces use global/public thumbnails. Preserve that following/global split unless product direction changes.
- `FeedPage` has a fallback to random public moments when the personalized following feed is empty. Keep this new-user fallback so fresh accounts do not see a blank home feed.
- `NotificationsPage` and `BottomNav` coordinate unread state through the `antigram:notifications-read` browser event. If another place marks notifications as read, dispatch the same event so the nav badge does not stay stale.
- `src/lib/db.ts` is the central Supabase data access layer. Keep query helpers there unless there is a strong reason to introduce a new boundary.
- `getMomentsByEmotion` / emotion aggregation style queries should be reviewed before scale; client-side aggregation is acceptable for now but is not the desired long-term pattern for large data.
- Premium and Telegram Stars are Telegram-specific. Do not port Telegram Stars mechanics to the native mobile client as a payment rail without revisiting platform rules and product strategy.
- Premium / Stars payment flows should be verified end-to-end against deployed Edge Functions before treating the feature as production-safe.
- Root-level `supabase_migration_film_preset.sql` and `supabase_migration_profile.sql` are legacy/ad-hoc migration files. New migrations should go under `supabase/migrations/`.
- Root-level `CLAUDE_CODE_*_PROMPT.md` files are old task briefs, not living project documentation, unless a user explicitly points to one.

## Important Files to Read First

1. `src/contexts/AuthContext.tsx` — dual auth flow (Telegram initData vs. email), how sessions are established
2. `src/lib/db.ts` — every Supabase query in the app; this is the data access layer
3. `src/App.tsx` — route tree, nav/player show/hide logic
4. `src/components/BottomNav.tsx` — the film-picker bottom sheet and 5-tab nav
5. `src/pages/FeedPage.tsx` and `ExplorePage.tsx` — the two main feed implementations
6. `src/pages/UploadPage.tsx` — LUT filter processing pipeline (Canvas 2D, grain/flare/color)
7. `../supabase/functions/telegram-auth/index.ts` — Telegram initData verification (server-side HMAC)
