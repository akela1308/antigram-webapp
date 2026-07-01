// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const WEBAPP_URL = Deno.env.get('WEBAPP_URL') ?? 'https://antigram-webapp.vercel.app'

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
  language_code?: string
}

interface TelegramUpdate {
  update_id?: number
  callback_query?: {
    id: string
    from?: TelegramUser
    message?: {
      chat?: { id: number | string }
      message_id?: number
    }
    data?: string
  }
  pre_checkout_query?: {
    id: string
    from?: TelegramUser
    currency: string
    total_amount: number
    invoice_payload: string
  }
  message?: {
    chat?: { id: number | string }
    from?: TelegramUser
    text?: string
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

type BotLanguage = 'ru' | 'en'
type BotTextKey = 'fallback' | 'what' | 'upload' | 'support' | 'welcome'

const BOT_TEXT: Record<BotLanguage, Record<BotTextKey, string>> = {
  ru: {
    fallback:
      'Я бот Antigram. Пока главный путь здесь простой: открыть приложение и публиковать моменты.\n\n' +
      'Нажми кнопку ниже или отправь /start, чтобы увидеть меню.',
    what:
      'Что можно делать в Antigram:\n\n' +
      '• публиковать моменты как кадры на плёнке;\n' +
      '• выбирать настроение кадра;\n' +
      '• собирать альбомы;\n' +
      '• находить людей через поиск и подборки;\n' +
      '• ставить реакции и поддерживать авторов Stars.',
    upload:
      'Как загрузить кадр:\n\n' +
      '1. Нажми “Открыть Antigram”.\n' +
      '2. Перейди на камеру/загрузку.\n' +
      '3. Выбери фото, плёнку и настроение.\n' +
      '4. Опубликуй момент — он появится в ленте и профиле.',
    support:
      'Если что-то не работает или есть идея — напиши в поддержку внутри профиля Antigram.\n\n' +
      'Можно также описать проблему прямо здесь, а мы позже подключим полноценные ответы бота.',
    welcome:
      'Это Antigram.\n\n' +
      'Здесь сохраняют моменты как кадры на плёнке: фото, настроение, альбомы, реакции и люди, которых хочется найти по вайбу.\n\n' +
      'Начни с приложения — там уже можно смотреть ленту, загружать кадры и собирать профиль.',
  },
  en: {
    fallback:
      'I am the Antigram bot. For now, the main path is simple: open the app and publish moments.\n\n' +
      'Tap the button below or send /start to see the menu.',
    what:
      'What you can do in Antigram:\n\n' +
      '• publish moments as film-like frames;\n' +
      '• choose a mood for each photo;\n' +
      '• collect albums;\n' +
      '• discover people through search and collections;\n' +
      '• react to photos and support authors with Stars.',
    upload:
      'How to upload a frame:\n\n' +
      '1. Tap “Open Antigram”.\n' +
      '2. Go to camera/upload.\n' +
      '3. Choose a photo, film look, and mood.\n' +
      '4. Publish the moment — it will appear in the feed and on your profile.',
    support:
      'If something does not work or you have an idea, write to support from your Antigram profile.\n\n' +
      'You can also describe the issue here; later we will connect full bot replies.',
    welcome:
      'This is Antigram.\n\n' +
      'Save moments as film-like frames: photos, moods, albums, reactions, and people you discover by the feeling of a shot.\n\n' +
      'Start with the app — you can already browse the feed, upload frames, and build your profile there.',
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) {
      console.error('[Stars] missing env vars')
      return json({ ok: false, error: 'Server is not configured' }, 500)
    }

    const update = await req.json() as TelegramUpdate
    const hasValidWebhookSecret =
      !WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') === WEBHOOK_SECRET
    const hasPaymentUpdate = Boolean(update.pre_checkout_query || update.message?.successful_payment)

    if (!hasValidWebhookSecret && hasPaymentUpdate) {
      console.error('[Stars] payment update rejected: invalid webhook secret')
      return json({ ok: false, error: 'Invalid webhook secret' }, 401)
    }

    if (!hasValidWebhookSecret) {
      console.warn('[Bot] non-payment update received without valid webhook secret')
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── bot menu / onboarding ──────────────────────────────────────────────────
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
      return json({ ok: true })
    }

    const text = update.message?.text?.trim()
    if (text) {
      await handleBotMessage(update.message)
      return json({ ok: true })
    }

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

      // Notify author — awaited but never fails the webhook
      if (result && !result.already_paid) {
        await notifyAuthor(admin, result, update.message?.from).catch(err => {
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

// ── bot onboarding ──────────────────────────────────────────────────────────────

async function handleBotMessage(message: NonNullable<TelegramUpdate['message']>) {
  const chatId = message.chat?.id
  if (!chatId) return

  const text = message.text?.trim().toLowerCase() ?? ''
  const language = getUserLanguage(message.from)

  if (text.startsWith('/start') || text.startsWith('/help') || text === 'start') {
    await configureBotSurface(chatId, language)
    await sendWelcome(chatId, message.from, language)
    return
  }

  if (text.startsWith('/language')) {
    await sendWelcome(chatId, message.from, language)
    return
  }

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: BOT_TEXT[language].fallback,
    reply_markup: mainKeyboard(language),
  })
}

async function handleCallbackQuery(query: NonNullable<TelegramUpdate['callback_query']>) {
  await telegramApi('answerCallbackQuery', { callback_query_id: query.id })

  const chatId = query.message?.chat?.id
  if (!chatId) return

  const { action, language } = parseCallbackData(query.data, query.from)

  if (action === 'lang') {
    await sendWelcome(chatId, query.from, language)
    return
  }

  if (action === 'what' || action === 'upload' || action === 'support') {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: BOT_TEXT[language][action],
      reply_markup: mainKeyboard(language),
    })
    return
  }

  await sendWelcome(chatId, query.from, language)
}

async function sendWelcome(chatId: number | string, user?: TelegramUser, language = getUserLanguage(user)) {
  const name = user?.first_name ? `, ${user.first_name}` : ''
  const greeting = language === 'ru' ? `Привет${name}. ` : `Hi${name}. `

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: greeting + BOT_TEXT[language].welcome,
    reply_markup: mainKeyboard(language),
  })
}

async function configureBotSurface(chatId: number | string, language: BotLanguage) {
  await Promise.all([
    telegramApi('setMyCommands', {
      commands: [
        { command: 'start', description: 'Open Antigram menu' },
        { command: 'help', description: 'Show Antigram help' },
        { command: 'language', description: 'Change language' },
      ],
    }),
    telegramApi('setMyCommands', {
      language_code: 'ru',
      commands: [
        { command: 'start', description: 'Открыть меню Antigram' },
        { command: 'help', description: 'Помощь по Antigram' },
        { command: 'language', description: 'Сменить язык' },
      ],
    }),
    telegramApi('setChatMenuButton', {
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: language === 'ru' ? 'Открыть Antigram' : 'Open Antigram',
        web_app: { url: WEBAPP_URL },
      },
    }),
  ])
}

function mainKeyboard(language: BotLanguage) {
  const nextLanguage: BotLanguage = language === 'ru' ? 'en' : 'ru'

  return {
    inline_keyboard: [
      [
        {
          text: language === 'ru' ? 'Открыть Antigram' : 'Open Antigram',
          web_app: { url: WEBAPP_URL },
        },
      ],
      [
        { text: language === 'ru' ? 'Что здесь делать?' : 'What can I do here?', callback_data: `what:${language}` },
        { text: language === 'ru' ? 'Как загрузить кадр?' : 'How do I upload?', callback_data: `upload:${language}` },
      ],
      [
        { text: language === 'ru' ? 'Поддержка' : 'Support', callback_data: `support:${language}` },
        { text: language === 'ru' ? 'English' : 'Русский', callback_data: `lang:${nextLanguage}` },
      ],
    ],
  }
}

function getUserLanguage(user?: TelegramUser): BotLanguage {
  return user?.language_code?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function parseCallbackData(data: string | undefined, user?: TelegramUser): {
  action: string
  language: BotLanguage
} {
  const fallback = getUserLanguage(user)
  const [action = 'start', rawLanguage] = (data ?? '').split(':')
  return {
    action,
    language: rawLanguage === 'ru' || rawLanguage === 'en' ? rawLanguage : fallback,
  }
}

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
