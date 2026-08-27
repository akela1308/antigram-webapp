// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

// POST { kind: 'moment' | 'premium', id: '<uuid платежа>' }
// Заголовок Authorization: Bearer <jwt пользователя>.
//
// Идентификаторы платежей Telegram в браузер не отдаются: клиент присылает
// внутренний uuid, а charge id читает эта функция под service_role.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RefundBody {
  kind?: 'moment' | 'premium'
  id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) {
      console.error('[Refund] missing env vars')
      return json({ error: 'Server is not configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authorization required' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Право на возврат проверяем на сервере, а не по тому, что показал интерфейс.
    const { data: isAdmin, error: adminError } = await admin.rpc('is_admin_user', {
      p_user_id: userData.user.id,
    })
    if (adminError || isAdmin !== true) {
      console.error('[Refund] rejected for', userData.user.id, adminError)
      return json({ error: 'Not allowed' }, 403)
    }

    const body = await req.json() as RefundBody
    const kind = body.kind === 'premium' ? 'premium' : 'moment'
    const id = body.id?.trim()
    if (!id) return json({ error: 'id required' }, 400)

    const table = kind === 'premium' ? 'premium_subscriptions' : 'star_payments'
    const { data: row, error: rowError } = await admin
      .from(table)
      .select('telegram_payment_charge_id, telegram_payer_id, status')
      .eq('id', id)
      .maybeSingle()

    const payment = row as {
      telegram_payment_charge_id: string | null
      telegram_payer_id: number | null
      status: string
    } | null

    if (rowError || !payment) return json({ error: 'Payment not found' }, 404)
    if (!payment.telegram_payment_charge_id) {
      return json({ error: 'Этот платёж не был оплачен, возвращать нечего' }, 400)
    }
    if (!payment.telegram_payer_id) {
      // Без Telegram-id плательщика Bot API возврат не примет.
      return json({ error: 'В платеже нет Telegram-плательщика — верните вручную через поддержку' }, 400)
    }

    // 1. Сначала возвращаем звёзды в Telegram. Если этот шаг не прошёл,
    //    базу не трогаем: иначе доступ снят, а деньги у нас.
    const refundRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/refundStarPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payment.telegram_payer_id,
        telegram_payment_charge_id: payment.telegram_payment_charge_id,
      }),
    })
    const refundBody = await refundRes.json() as { ok: boolean; description?: string }

    if (!refundBody.ok) {
      console.error('[Refund] telegram refund failed:', refundBody)
      return json({ error: refundBody.description ?? 'Telegram отказал в возврате' }, 502)
    }

    // 2. Теперь снимаем начисленное. Обе функции идемпотентны.
    const rpc = kind === 'premium' ? 'refund_premium_subscription' : 'refund_star_payment'
    const { data: result, error: rpcError } = await admin.rpc(rpc, {
      p_telegram_payment_charge_id: payment.telegram_payment_charge_id,
    })

    if (rpcError) {
      // Звёзды уже вернулись пользователю, а база отстала — это видно в логах
      // и чинится повторным нажатием: возврат в Telegram повторно не спишет.
      console.error('[Refund] db update failed after telegram refund:', rpcError)
      return json({ error: 'Звёзды вернулись, но статус в базе не обновился. Нажмите ещё раз.' }, 500)
    }

    console.log('[Refund] done', kind, id, 'by', userData.user.id)
    return json({ ok: true, result })
  } catch (error) {
    console.error('[Refund] unexpected:', error)
    return json({ error: 'Unexpected error' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
