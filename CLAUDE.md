# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ANTIGRAM Telegram Mini App — a React + Vite web client for the same product as `../mobile` (Expo/React Native). Both clients hit the same Supabase project/schema; there is no shared code between them, so when porting a feature from one to the other, treat the other repo as a reference implementation to read, not a dependency to import.

**Telegram-specific API usage (`window.Telegram.WebApp`, safe areas, BackButton, HapticFeedback, theme CSS vars, platform quirks) is already documented in `TG_MINIAPP_REFERENCE.md` in this same directory — read that before writing any `Telegram.WebApp` code instead of re-deriving it.**

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc (project references) + vite build — this is the only typecheck, and it's strict:
                   # tsconfig.json has noUnusedLocals + noUnusedParameters, so an unused import fails the build
npm run preview   # preview the production build locally
```

No test suite, no separate lint script — `npm run build` is the full check.

Deploy: push to `main` → Vercel auto-deploys (see `DEPLOY_GUIDE.md` for first-time setup: Vercel project linking, Supabase Edge Function deploy, BotFather registration). Edge Functions are deployed separately via `supabase functions deploy <name> --no-verify-jwt` (they're called with the anon key, not a user JWT).

Env vars (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`. **Never add `VITE_TELEGRAM_BOT_TOKEN`/`BOT_TOKEN` to Vercel or any client-side env** — the bot token is a server secret and only belongs in Supabase Edge Function secrets (`supabase secrets set BOT_TOKEN=...`), since anything prefixed `VITE_` is bundled into the client JS.

## Architecture

### Dual auth: Telegram-context vs standalone web

This app runs in two contexts, both handled by `src/contexts/AuthContext.tsx`:
- **Inside Telegram** (opened via the bot's Mini App button): `isTelegramContext()` detects a non-empty `Telegram.WebApp.initData`, and the app auto-logs-in by sending `initData` to the `telegram-auth` Edge Function (`supabase/functions/telegram-auth/`), which HMAC-verifies it against the bot token and mints a Supabase session server-side. No login form is shown.
- **As a plain web app** (e.g. local dev, or a browser tab): falls back to normal Supabase email/password auth (`AuthPage.tsx`, `signIn`/`signUp` on the context).

`telegram-auth` verifies the HMAC signature and `auth_date` freshness before trusting `initData` — do not weaken or bypass that check when touching the function.

### Routing & pages

`react-router-dom`, routes defined in `src/App.tsx`, one file per route under `src/pages/`. `FeedPage` = Home tab, `ExplorePage` = Search tab. Both use `CategoryFilmStrip` for the emotion-category strip, but with different thumbnail scope: `FeedPage` passes `thumbnailScope="following"` (thumbnails only from people the user follows, via `getFollowingCategoryThumbnails`), `ExplorePage` leaves it as the default `"global"` (`getGlobalCategoryThumbnails`, everyone). This following/global split is intentional and mirrored (or should be) in the mobile client.

`FeedPage`'s "for you" tab falls back to `getRandomMoments()` when the personalized `getFeed()` result is empty (new users following nobody) — don't remove that fallback, it's what keeps new-user feeds from being blank.

### Data layer — `src/lib/db.ts`

Same pattern as the mobile client: all Supabase queries in one file, grouped by domain, screens call functions directly (no service/repository class layer). `getMomentsByEmotion` currently does client-side aggregation (fetches all matching reactions, counts in memory, then fetches moments) — this is a known perf issue at scale, not a design to copy elsewhere.

### Monetization (Telegram Stars) — scaffolded but disabled

`src/lib/premium.ts` exports `PREMIUM_ENABLED = false` — all premium/Stars UI and limits (`PremiumPage.tsx`, daily frame limits, highlight limits) are built against this flag and currently off. Supabase migrations for it already exist (`premium_subscriptions`, `daily_frame_limit`, `star_support`) and Edge Functions `create-star-invoice` / `telegram-stars-webhook` handle the payment flow. This entire area is Telegram-only by design — it must not be ported to the mobile client (Android/iOS can't use Telegram Stars as a payment rail; see `STAR_REACTIONS_STRATEGY.md` for the product reasoning).

### Notifications

`NotificationsPage.tsx` + `BottomNav.tsx` — read receipts and the unread badge are decoupled: marking read fires a `window.dispatchEvent(new Event('antigram:notifications-read'))` so `BottomNav`'s badge count updates immediately without waiting for its own poll/focus cycle. If you add another place that marks notifications read, dispatch the same event or the nav badge will go stale.

### Music player

`PlayerContext` + `MiniPlayer` — same app-wide background-music concept as the mobile client (`src/context/PlayerContext.tsx` there), independent implementation here, not shared code.

## Housekeeping notes

- `supabase_migration_film_preset.sql` and `supabase_migration_profile.sql` at repo root are legacy/ad-hoc migration files predating the `supabase/migrations/` directory convention — the actual migration history lives in `supabase/migrations/*.sql`. Don't add new migrations at the repo root.
- Several `CLAUDE_CODE_*_PROMPT.md` files at the repo root are one-off task briefs from past sessions, not living documentation — safe to ignore unless explicitly pointed at one.
