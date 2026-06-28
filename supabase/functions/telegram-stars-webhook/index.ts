// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface TelegramUser {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramUpdate {
  update_id?: number
  pre_checkout_query?: {
    id: string
    from?: TelegramUser
    currency: string
    total_amount: number
    invoice_payload: string
  }
  message?: {
    from?: TelegramUser
    successful_payment?: {
      currency: string
      total_amount: number
      invoice_payload: string
      telegram_payment_charge_id: string
      provider_payment_charge_id?: string
    }
  }
}

interface StarPaymentRow {
  id: string
  amount: number
  currency: string
  status: string
}

interface CompletePaymentResult {
  payment_id: string
  moment_id: string
  author_id: string
  amount: number
  already_paid: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  if (WEBHOOK_SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
    return json({ ok: false, error: 'Invalid webhook secret' }, 401)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) {
      console.error('[Stars] missing env vars')
      return json({ ok: false, error: 'Server is not configured' }, 500)
    }

    const update = await req.json() as TelegramUpdate
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── pre_checkout_query ──────────────────────────────────────────────────────
    if (update.pre_checkout_query) {
      await handlePreCheckout(admin, update.pre_checkout_query)
      return json({ ok: true })
    }

    // ── successful_payment ──────────────────────────────────────────────────────
    const successfulPayment = update.message?.successful_payment
    if (successfulPayment) {
      if (successfulPayment.currency !== 'XTR') {
        console.error('[Stars] unexpected currency:', successfulPayment.currency)
        return json({ ok: true })
      }

      const { data, error } = await admin.rpc('complete_star_payment', {
        p_invoice_payload: successfulPayment.invoice_payload,
        p_telegram_payment_charge_id: successfulPayment.telegram_payment_charge_id,
        p_provider_payment_charge_id: successfulPayment.provider_payment_charge_id ?? null,
        p_telegram_payer_id: update.message?.from?.id ?? null,
        p_raw_update: update,
      })

      if (error) {
        console.error('[Stars] complete payment failed:', error)
        return json({ ok: false, error: 'Payment completion failed' }, 500)
      }

      const result = (data as CompletePaymentResult[] | null)?.[0]

      // Send author notification (fire-and-forget — never fails the webhook)
      if (result && !result.already_paid) {
        notifyAuthor(admin, result, update.message?.from).catch(err => {
          console.error('[Stars] author notification failed:', err)
        })
      }

      return json({ ok: true })
    }

    return json({ ok: true })
  } catch (error) {
    console.error('[Stars] webhook unexpected:', error)
    return json({ ok: false, error: 'Unexpected error' }, 500)
  }
})

// ── notifyAuthor ────────────────────────────────────────────────────────────────

async function notifyAuthor(
  admin: ReturnType<typeof createClient>,
  payment: CompletePaymentResult,
  payer?: TelegramUser,
): Promise<void> {
  // Get author's Telegram ID from auth.users metadata
  const { data: authorUserData, error: userErr } = await admin.auth.admin.getUserById(payment.author_id)
  if (userErr || !authorUserData?.user) {
    console.error('[Stars] could not fetch author user:', userErr)
    return
  }

  const meta = authorUserData.user.user_metadata as Record<string, unknown> | undefined
  let authorTelegramId: number | null =
    typeof meta?.telegram_id === 'number' ? meta.telegram_id : null

  // Fallback: parse from email tg{ID}@antigram.internal
  if (!authorTelegramId) {
    const match = authorUserData.user.email?.match(/^tg(\d+)@/)
    if (match) authorTelegramId = Number(match[1])
  }

  if (!authorTelegramId) {
    console.error('[Stars] author has no Telegram ID, skipping notification')
    return
  }

  // Don't notify if author == payer
  if (payer?.id && authorTelegramId === payer.id) return

  // Build payer display name
  let payerName = 'кто-то'
  if (payer?.username) {
    payerName = `@${payer.username}`
  } else if (payer?.first_name) {
    payerName = payer.first_name
  }

  // Star word form: 1 звезда / 2-4 звезды / 5+ звёзд
  const starLabel = starWordForm(payment.amount)

  const text =
    `★ ${payment.amount} ${starLabel}\n\n` +
    `${payerName} поддержал твой кадр в Antigram.\n\n` +
    `Stars увеличивают твой рейтинг в приложении.`

  await telegramApi('sendMessage', {
    chat_id: authorTelegramId,
    text,
  })

  console.log(`[Stars] notified author ${authorTelegramId} — ${payment.amount} Stars from ${payerName}`)
}

function starWordForm(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'звёзд'
  if (mod10 === 1) return 'звезда'
  if (mod10 >= 2 && mod10 <= 4) return 'звезды'
  return 'звёзд'
}

// ── handlePreCheckout ───────────────────────────────────────────────────────────

async function handlePreCheckout(
  admin: ReturnType<typeof createClient>,
  query: NonNullable<TelegramUpdate['pre_checkout_query']>,
) {
  const { data, error } = await admin
    .from('star_payments')
    .select('id, amount, currency, status')
    .eq('invoice_payload', query.invoice_payload)
    .maybeSingle()

  const payment = data as StarPaymentRow | null
  const ok = !error
    && payment !== null
    && payment.status === 'pending'
    && payment.currency === 'XTR'
    && query.currency === 'XTR'
    && payment.amount === query.total_amount

  await telegramApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: query.id,
    ok,
    error_message: ok ? undefined : 'Не удалось подтвердить счёт Antigram. Попробуйте ещё раз.',
  })

  if (!ok) {
    console.error('[Stars] pre_checkout rejected:', { query, error, payment })
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────────

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[Stars] Telegram ${method} failed:`, body)
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
