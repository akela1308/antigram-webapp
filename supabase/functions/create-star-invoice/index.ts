// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''

const STAR_AMOUNTS = new Set([1, 5, 10, 50])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateInvoiceBody {
  momentId?: string
  amount?: number
}

interface TelegramInvoiceResponse {
  ok: boolean
  result?: string
  description?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !BOT_TOKEN) {
      console.error('[Stars] missing env vars — URL:', !!SUPABASE_URL, 'ANON:', !!SUPABASE_ANON_KEY, 'SERVICE:', !!SUPABASE_SERVICE_ROLE_KEY, 'BOT:', !!BOT_TOKEN)
      return json({ error: 'Server is not configured' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authorization required' }, 401)
    }

    const body = await req.json() as CreateInvoiceBody
    const momentId = body.momentId?.trim()
    const amount = Number(body.amount)

    if (!momentId) {
      return json({ error: 'momentId required' }, 400)
    }
    if (!Number.isInteger(amount) || !STAR_AMOUNTS.has(amount)) {
      return json({ error: 'Unsupported Stars amount' }, 400)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()

    if (userError || !userData.user) {
      return json({ error: 'Invalid session' }, 401)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: moment, error: momentError } = await admin
      .from('moments')
      .select('id, user_id, caption')
      .eq('id', momentId)
      .single()

    if (momentError || !moment) {
      return json({ error: 'Moment not found' }, 404)
    }

    const payload = `star_${crypto.randomUUID()}`
    const { data: payment, error: insertError } = await admin
      .from('star_payments')
      .insert({
        invoice_payload: payload,
        payer_id: userData.user.id,
        moment_id: moment.id,
        author_id: moment.user_id,
        amount,
        currency: 'XTR',
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !payment) {
      console.error('[Stars] payment insert failed:', insertError)
      return json({ error: 'Payment could not be created' }, 500)
    }

    const invoiceRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Поддержать кадр',
        description: `${amount} Telegram Stars для рейтинга автора в Antigram`,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: `${amount} Stars`, amount }],
      }),
    })
    const invoiceBody = await invoiceRes.json() as TelegramInvoiceResponse

    if (!invoiceRes.ok || !invoiceBody.ok || !invoiceBody.result) {
      console.error('[Stars] createInvoiceLink failed:', invoiceBody)
      await admin
        .from('star_payments')
        .update({ status: 'failed', raw_update: invoiceBody })
        .eq('id', payment.id)
      return json({ error: invoiceBody.description ?? 'Telegram invoice failed' }, 502)
    }

    return json({ invoiceLink: invoiceBody.result, paymentId: payment.id })
  } catch (error) {
    console.error('[Stars] create invoice unexpected:', error)
    return json({ error: 'Unexpected error' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
