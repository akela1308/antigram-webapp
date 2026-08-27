// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const WEBAPP_URL = Deno.env.get('WEBAPP_URL') ?? 'https://antigram-webapp.vercel.app'

// Счета двух видов различаются префиксом payload: `star_…` — поддержка кадра,
// `premium_…` — подписка. Payload генерирует сервер, подделать вид нельзя.
const PREMIUM_PAYLOAD_PREFIX = 'premium_'
const isPremiumPayload = (payload: string | undefined | null) =>
  Boolean(payload && payload.startsWith(PREMIUM_PAYLOAD_PREFIX))

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

interface CompletePremiumResult {
  subscription_id: string
  user_id: string
  expires_at: string
  already_active: boolean
}

interface CompletePaymentResult {
  payment_id: string
  moment_id: string
  author_id: string
  amount: number
  already_paid: boolean
}

type BotLanguage = 'ru' | 'en'
type BotTextKey = 'fallback' | 'what' | 'upload' | 'support' | 'welcome' | 'paysupport'
type AuthorNotificationResult =
  | { status: 'sent' }
  | { status: 'failed'; error: string }
  | { status: 'skipped'; error: string }

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
    paysupport:
      'Оплата в Antigram проходит через Telegram Stars.\n\n' +
      'Звёздами можно поддержать понравившийся кадр и оформить Antigram Premium. ' +
      'Поддержка кадра — это добровольный знак признания и рейтинг автора, а не перевод денег автору.\n\n' +
      'Если звёзды списались, а доступ или счётчик не появились — напишите сюда. ' +
      'Укажите дату и сумму платежа: мы найдём его по идентификатору Telegram и вернём звёзды, если покупка не сработала.\n\n' +
      'Полные условия — в разделе «Условия» внутри приложения.',
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
    paysupport:
      'Payments in Antigram go through Telegram Stars.\n\n' +
      'Stars can support a frame you like and unlock Antigram Premium. ' +
      'Supporting a frame is a voluntary appreciation signal and author reputation, not a money transfer to the author.\n\n' +
      'If Stars were charged but the access or counter did not appear, write here. ' +
      'Include the date and amount: we will find the payment by its Telegram identifier and refund the Stars if the purchase did not work.\n\n' +
      'Full rules are in the Terms section inside the app.',
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
    const hasPaymentUpdate = Boolean(update.pre_checkout_query || update.message?.successful_payment)

    // Раньше здесь было `!WEBHOOK_SECRET || ...`: при незаданном секрете любой
    // запрос считался валидным, включая платёжные. Это открытая дверь —
    // достаточно выписать себе счёт на 1 звезду, взять его invoice_payload и
    // прислать поддельный successful_payment, ничего не заплатив.
    // Платежи теперь fail closed: нет секрета — нет обработки.
    const suppliedSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    const hasValidWebhookSecret = Boolean(WEBHOOK_SECRET) && timingSafeEqual(suppliedSecret, WEBHOOK_SECRET)

    if (hasPaymentUpdate && !hasValidWebhookSecret) {
      console.error(
        WEBHOOK_SECRET
          ? '[Stars] payment update rejected: invalid webhook secret'
          : '[Stars] payment update rejected: TELEGRAM_WEBHOOK_SECRET is not set',
      )
      return json({ ok: false, error: 'Invalid webhook secret' }, 401)
    }

    // Не платёжные апдейты (меню бота) пока пропускаем даже без секрета, чтобы
    // не уронить живого бота, если webhook зарегистрирован без secret_token.
    // Как только setWebhook будет перевыпущен с секретом — это можно ужесточить.
    if (!hasValidWebhookSecret) {
      console.warn('[Bot] non-payment update received without valid webhook secret')
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const webhookEventId = await recordWebhookEvent(admin, update).catch(error => {
      console.error('[Stars] webhook event record failed:', error)
      return null
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

      if (isPremiumPayload(successfulPayment.invoice_payload)) {
        await handlePremiumPayment(admin, update, successfulPayment)
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
        const notification = await notifyAuthor(admin, result, update.message?.from).catch(err => {
          console.error('[Stars] author notification failed:', err)
          return { status: 'failed', error: String(err) } as AuthorNotificationResult
        })
        await recordAuthorNotification(admin, result.payment_id, notification)
      }

      if (webhookEventId && result?.payment_id) {
        await linkWebhookEventToPayment(admin, webhookEventId, result.payment_id)
      }

      return json({ ok: true })
    }

    return json({ ok: true })
  } catch (error) {
    console.error('[Stars] webhook unexpected:', error)
    return json({ ok: false, error: 'Unexpected error' }, 500)
  }
})

// ── premium ─────────────────────────────────────────────────────────────────

/**
 * Подтверждение счёта на подписку. Цена сверяется с той, что сервер записал в
 * строку подписки при выписке счёта: клиент её не присылает и подменить не может.
 * Ответить нужно за 10 секунд, иначе Telegram отменит платёж.
 */
async function handlePremiumPreCheckout(
  admin: ReturnType<typeof createClient>,
  query: NonNullable<TelegramUpdate['pre_checkout_query']>,
) {
  const { data, error } = await admin
    .from('premium_subscriptions')
    .select('id, status, price_stars')
    .eq('invoice_payload', query.invoice_payload)
    .maybeSingle()

  const subscription = data as { id: string; status: string; price_stars: number } | null
  const ok = !error
    && subscription !== null
    && subscription.status === 'pending'
    && query.currency === 'XTR'
    && subscription.price_stars === query.total_amount

  await telegramApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: query.id,
    ok,
    error_message: ok ? undefined : 'Не удалось подтвердить счёт Antigram Premium. Попробуйте ещё раз.',
  })

  if (!ok) {
    console.error('[Premium] pre_checkout rejected:', { query, error, subscription })
  }
}

/**
 * Активация подписки. Единственная точка, где премиум включается, — и только
 * после successful_payment от Telegram.
 */
async function handlePremiumPayment(
  admin: ReturnType<typeof createClient>,
  update: TelegramUpdate,
  payment: NonNullable<NonNullable<TelegramUpdate['message']>['successful_payment']>,
) {
  const chatId = update.message?.chat?.id
  const language = getUserLanguage(update.message?.from)

  const { data, error } = await admin.rpc('complete_premium_subscription', {
    p_invoice_payload: payment.invoice_payload,
    p_telegram_payment_charge_id: payment.telegram_payment_charge_id,
    p_provider_payment_charge_id: payment.provider_payment_charge_id ?? null,
    p_telegram_payer_id: update.message?.from?.id ?? null,
    p_raw_update: update,
  })

  if (error) {
    console.error('[Premium] activation failed:', error, payment.invoice_payload)
    if (chatId) {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: language === 'ru'
          ? 'Оплата получена, но включить Premium не удалось. Отправьте /paysupport — разберёмся и вернём звёзды.'
          : 'Payment received, but Premium could not be activated. Send /paysupport — we will sort it out or refund the Stars.',
      })
    }
    return
  }

  const result = (data as CompletePremiumResult[] | null)?.[0]

  // Повторная доставка вебхука: подписка уже активна, второй раз не сообщаем.
  if (!result || result.already_active) {
    console.log('[Premium] duplicate webhook for', payment.invoice_payload)
    return
  }

  console.log('[Premium] activated', result.subscription_id, 'until', result.expires_at)

  if (chatId) {
    const until = new Date(result.expires_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB')
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: language === 'ru'
        ? `Antigram Premium активен до ${until}. Больше кадров в день, редкие плёнки и расширенная плёнка профиля уже доступны.`
        : `Antigram Premium is active until ${until}. More frames per day, rare films, and an extended profile strip are available now.`,
      reply_markup: mainKeyboard(language),
    })
  }
}

/** Сравнение секрета без утечки времени. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return diff === 0
}

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

  // Telegram требует эту команду от ботов, принимающих платежи.
  if (text.startsWith('/paysupport') || text.startsWith('/refund')) {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: BOT_TEXT[language].paysupport,
      reply_markup: mainKeyboard(language),
    })
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
        { command: 'paysupport', description: 'Payments and refunds' },
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
): Promise<AuthorNotificationResult> {
  // Get author's Telegram ID from auth.users metadata
  const { data: authorUserData, error: userErr } = await admin.auth.admin.getUserById(payment.author_id)
  if (userErr || !authorUserData?.user) {
    console.error('[Stars] could not fetch author user:', userErr)
    return { status: 'failed', error: userErr?.message ?? 'author_user_not_found' }
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
    return { status: 'skipped', error: 'author_has_no_telegram_id' }
  }

  // Don't notify if author == payer
  if (payer?.id && authorTelegramId === payer.id) {
    return { status: 'skipped', error: 'author_is_payer' }
  }

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

  const sent = await telegramApi('sendMessage', {
    chat_id: authorTelegramId,
    text,
  })

  if (!sent.ok) {
    return { status: 'failed', error: sent.error ?? 'telegram_send_failed' }
  }

  console.log(`[Stars] notified author ${authorTelegramId} — ${payment.amount} Stars from ${payerName}`)
  return { status: 'sent' }
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
  if (isPremiumPayload(query.invoice_payload)) {
    await handlePremiumPreCheckout(admin, query)
    return
  }

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
    return
  }

  await admin
    .from('star_payments')
    .update({ pre_checkout_seen_at: new Date().toISOString() })
    .eq('id', payment.id)
    .then(({ error: updateError }) => {
      if (updateError && !isMissingColumnError(updateError, 'pre_checkout_seen_at')) {
        console.error('[Stars] pre_checkout marker failed:', updateError)
      }
    })
}

async function recordWebhookEvent(
  admin: ReturnType<typeof createClient>,
  update: TelegramUpdate,
): Promise<string | null> {
  const payload = {
    update_id: update.update_id ?? null,
    update_type: getWebhookUpdateType(update),
    invoice_payload: getWebhookInvoicePayload(update),
    processing_status: 'handled',
    raw_update: update,
  }

  const query = update.update_id
    ? admin.from('star_webhook_events').upsert(payload, { onConflict: 'update_id' })
    : admin.from('star_webhook_events').insert(payload)

  const { data, error } = await query.select('id').maybeSingle()
  if (error) {
    if (!isMissingTableOrColumnError(error, 'star_webhook_events')) {
      console.error('[Stars] webhook ledger insert failed:', error)
    }
    return null
  }

  return (data as { id?: string } | null)?.id ?? null
}

async function linkWebhookEventToPayment(
  admin: ReturnType<typeof createClient>,
  eventId: string,
  paymentId: string,
) {
  const { error } = await admin
    .from('star_webhook_events')
    .update({ payment_id: paymentId, processing_status: 'handled' })
    .eq('id', eventId)

  if (error && !isMissingTableOrColumnError(error, 'star_webhook_events')) {
    console.error('[Stars] webhook ledger payment link failed:', error)
  }
}

async function recordAuthorNotification(
  admin: ReturnType<typeof createClient>,
  paymentId: string,
  notification: AuthorNotificationResult,
) {
  const { error } = await admin
    .from('star_payments')
    .update({
      author_notification_status: notification.status,
      author_notification_error: notification.status === 'sent' ? null : notification.error,
      author_notified_at: notification.status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', paymentId)

  if (error && !isMissingColumnError(error, 'author_notification_status')) {
    console.error('[Stars] author notification marker failed:', error)
  }
}

function getWebhookUpdateType(update: TelegramUpdate): 'pre_checkout_query' | 'successful_payment' | 'callback_query' | 'bot_message' | 'unknown' {
  if (update.pre_checkout_query) return 'pre_checkout_query'
  if (update.message?.successful_payment) return 'successful_payment'
  if (update.callback_query) return 'callback_query'
  if (update.message?.text) return 'bot_message'
  return 'unknown'
}

function getWebhookInvoicePayload(update: TelegramUpdate): string | null {
  return update.pre_checkout_query?.invoice_payload
    ?? update.message?.successful_payment?.invoice_payload
    ?? null
}

function isMissingTableOrColumnError(error: unknown, name: string): boolean {
  const text = getErrorText(error)
  return text.includes(name) || text.includes('Could not find the table')
}

function isMissingColumnError(error: unknown, column: string): boolean {
  return getErrorText(error).includes(column)
}

function getErrorText(error: unknown): string {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string } | null
  if (!maybeError) return ''
  return [
    maybeError.code,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean).join(' ')
}

// ── helpers ─────────────────────────────────────────────────────────────────────

async function telegramApi(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`[Stars] Telegram ${method} failed:`, body)
    return { ok: false, error: body }
  }

  return { ok: true }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
