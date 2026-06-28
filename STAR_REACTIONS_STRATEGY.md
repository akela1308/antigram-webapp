# Antigram Stars: product and policy structure

## Positioning

Stars under a photo are a paid appreciation signal, not a direct peer-to-peer transfer.

Recommended wording:
- "Support this frame with Telegram Stars."
- "Stars increase the author's Antigram reputation and may unlock internal bonuses."
- "Future creator payouts may be introduced separately, but are not guaranteed until the payout program is officially launched."

Avoid wording:
- "Send money to the author."
- "Earn Stars."
- "Withdraw your balance."
- "Guaranteed payouts."

## MVP mechanic

1. Every photo shows a star counter: `☆ 0`, then `★ 12`.
2. Tap opens a small picker: `1`, `5`, `10`, `50` Stars.
3. Before invoice, show a notice:
   - voluntary support;
   - increases author rating;
   - no guaranteed payout yet;
   - payment is processed via Telegram Stars;
   - link to `/terms`.
4. Backend creates a Telegram Stars invoice.
5. Mini App opens the invoice with `Telegram.WebApp.openInvoice`.
6. Backend trusts only Telegram `successful_payment`.
7. Database updates:
   - photo star total;
   - author reputation total;
   - payer history;
   - Telegram payment charge id for refund/support.

## Suggested public counters

Photo:
- `★ 0` below/near mood reactions.
- Tap target separated from free mood reactions.

Profile:
- `кадры`
- `подписчики`
- `подписки`
- `★ поддержка` or `★ рейтинг`

Do not call the profile counter "balance" until payouts are real and legally/operationally ready.

## Internal bonus ideas

These can be introduced before payouts:

- 10 Stars received: small profile star badge.
- 50 Stars received: extra daily frame slot.
- 100 Stars received: highlighted profile frame.
- 250 Stars received: one promoted frame slot.
- 500 Stars received: premium filters or creator badge.

For the free tier, a simple starting limit could be 4 published frames per day.
If bonuses increase the limit, show the current limit in the upload flow.

## Commission model

If creator payouts are launched later:

- Antigram can retain a service commission, for example 20%.
- Show commission before creator enrolls in payouts.
- Keep ledger records immutable.
- Payouts should be manual at first.
- Require support contact and identity/eligibility rules before payouts.

## Legal/product guardrails

- Stars are voluntary support and reputation.
- No guaranteed income.
- No automatic peer-to-peer transfer.
- No withdrawal promise until a separate payout program exists.
- Paid Stars do not prevent moderation or removal of content.
- Refunds are handled through support and Telegram payment identifiers.

## Required UX placements

- `/terms`: full rules.
- `/privacy`: payment metadata and data handling.
- Settings: links to Terms and Privacy.
- Payment sheet: short pre-payment disclaimer and Terms link.
- Bot command or support text: `/support` or `/paysupport`.

## Later database shape

Suggested tables:

- `star_payments`: invoice payload, user id, moment id, author id, amount, status, Telegram charge id.
- `moment_star_totals`: moment id, total amount.
- `profile_star_totals`: profile id, received amount, public reputation amount.
- `creator_rewards`: internal bonuses and manual payout eligibility.

The UI can show totals from aggregate tables, while the payment ledger remains append-only.

## Implemented MVP wiring

- UI component: `src/components/StarSupportButton.tsx`.
- Client helpers: `getMomentStarTotals`, `getProfileStarTotal`, `createStarInvoice` in `src/lib/db.ts`.
- Database migration: `supabase/migrations/202606280001_star_support.sql`.
- Invoice function: `supabase/functions/create-star-invoice`.
- Telegram webhook function: `supabase/functions/telegram-stars-webhook`.

## Deploy checklist

1. Apply the Supabase migration.
2. Set Supabase Edge Function secrets:
   - `BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` (recommended)
3. Deploy both Edge Functions.
4. Point the bot webhook to `https://<project-ref>.supabase.co/functions/v1/telegram-stars-webhook`.
5. If the bot already has another webhook, merge/forward `pre_checkout_query` and `successful_payment` there instead, because Telegram supports one webhook URL per bot.
6. Deploy the Mini App frontend after the backend is live.
