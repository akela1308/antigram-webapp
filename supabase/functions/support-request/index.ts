// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const SUPPORT_CHAT_ID = Deno.env.get('SUPPORT_CHAT_ID') ?? ''

const MAX_FILE_BYTES = 8 * 1024 * 1024

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !BOT_TOKEN || !SUPPORT_CHAT_ID) {
      console.error('[Support] missing env vars', {
        url: !!SUPABASE_URL,
        anon: !!SUPABASE_ANON_KEY,
        bot: !!BOT_TOKEN,
        supportChat: !!SUPPORT_CHAT_ID,
      })
      return json({ error: 'Поддержка пока не настроена' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Нужно войти в аккаунт' }, 401)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()

    if (userError || !userData.user) {
      return json({ error: 'Сессия устарела, войдите снова' }, 401)
    }

    const form = await req.formData()
    const message = stringValue(form.get('message')).trim()
    const displayName = stringValue(form.get('displayName')).trim()
    const username = stringValue(form.get('username')).trim()
    const telegramUsername = stringValue(form.get('telegramUsername')).trim()
    const telegramId = stringValue(form.get('telegramId')).trim()
    const pageUrl = stringValue(form.get('pageUrl')).trim()
    const fileValue = form.get('file')
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null

    if (!message && !file) {
      return json({ error: 'Опишите проблему или прикрепите файл' }, 400)
    }

    if (file && file.size > MAX_FILE_BYTES) {
      return json({ error: 'Файл больше 8 МБ' }, 400)
    }

    const authorLine = [
      displayName || 'Без имени',
      username ? `@${username.replace(/^@/, '')}` : '',
    ].filter(Boolean).join(' ')

    const tgLine = [
      telegramUsername ? `@${telegramUsername.replace(/^@/, '')}` : '',
      telegramId ? `id ${telegramId}` : '',
    ].filter(Boolean).join(', ')

    const text = [
      'Обращение в поддержку Antigram',
      '',
      `От: ${authorLine}`,
      `User ID: ${userData.user.id}`,
      userData.user.email ? `Email: ${userData.user.email}` : '',
      tgLine ? `Telegram: ${tgLine}` : '',
      pageUrl ? `Страница: ${pageUrl}` : '',
      '',
      message || '(без текста)',
    ].filter(line => line !== '').join('\n')

    await telegramJson('sendMessage', {
      chat_id: SUPPORT_CHAT_ID,
      text,
      disable_web_page_preview: true,
    })

    if (file) {
      await sendFile(file, userData.user.id)
    }

    return json({ ok: true })
  } catch (error) {
    console.error('[Support] unexpected error:', error)
    return json({ error: 'Не удалось отправить обращение' }, 500)
  }
})

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

async function telegramJson(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null

  if (!res.ok || !body?.ok) {
    console.error(`[Support] Telegram ${method} failed:`, body)
    throw new Error(body?.description ?? `Telegram ${method} failed`)
  }
}

async function sendFile(file: File, userId: string) {
  const form = new FormData()
  const method = file.type.startsWith('image/') ? 'sendPhoto' : 'sendDocument'
  const fieldName = method === 'sendPhoto' ? 'photo' : 'document'
  const blob = new Blob([await file.arrayBuffer()], {
    type: file.type || 'application/octet-stream',
  })

  form.append('chat_id', SUPPORT_CHAT_ID)
  form.append('caption', `Вложение к обращению\nUser ID: ${userId}`)
  form.append(fieldName, blob, file.name || 'attachment')

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    body: form,
  })
  const body = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null

  if (!res.ok || !body?.ok) {
    console.error(`[Support] Telegram ${method} failed:`, body)
    throw new Error(body?.description ?? `Telegram ${method} failed`)
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
