import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPPORT_EMAIL_TO = Deno.env.get('SUPPORT_EMAIL_TO') ?? 'akeva1308@gmail.com'
const SUPPORT_EMAIL_FROM = Deno.env.get('SUPPORT_EMAIL_FROM') ?? 'Antigram <support@antigram.app>'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const SUPPORT_BUCKET = 'support-attachments'

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Support] missing env vars', {
        url: !!SUPABASE_URL,
        anon: !!SUPABASE_ANON_KEY,
        service: !!SUPABASE_SERVICE_ROLE_KEY,
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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

    let attachmentPath: string | null = null
    if (file) {
      attachmentPath = `${userData.user.id}/${Date.now()}-${safeFileName(file.name || 'attachment')}`
      const { error: uploadError } = await admin.storage
        .from(SUPPORT_BUCKET)
        .upload(attachmentPath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadError) {
        console.error('[Support] attachment upload failed:', uploadError)
        return json({ error: 'Не удалось загрузить вложение' }, 500)
      }
    }

    const authorLine = [
      displayName || 'Без имени',
      username ? `@${username.replace(/^@/, '')}` : '',
    ].filter(Boolean).join(' ')

    const tgLine = [
      telegramUsername ? `@${telegramUsername.replace(/^@/, '')}` : '',
      telegramId ? `id ${telegramId}` : '',
    ].filter(Boolean).join(', ')

    const { data: request, error: insertError } = await admin
      .from('support_requests')
      .insert({
        reporter_id: userData.user.id,
        message,
        attachment_bucket: attachmentPath ? SUPPORT_BUCKET : null,
        attachment_path: attachmentPath,
        attachment_name: file?.name ?? null,
        attachment_type: file?.type || null,
        attachment_size: file?.size ?? null,
        page_url: pageUrl || null,
        metadata: {
          displayName,
          username,
          telegramUsername,
          telegramId,
          email: userData.user.email ?? null,
        },
      })
      .select('id')
      .single()

    if (insertError || !request) {
      console.error('[Support] insert failed:', insertError)
      return json({ error: 'Не удалось сохранить обращение' }, 500)
    }

    const emailSent = await sendEmailCopy({
      requestId: request.id as string,
      authorLine,
      tgLine,
      userId: userData.user.id,
      email: userData.user.email ?? '',
      pageUrl,
      message,
      attachmentName: file?.name ?? '',
      attachmentSize: file?.size ?? 0,
    })

    return json({ ok: true, id: request.id, emailSent })
  } catch (error) {
    console.error('[Support] unexpected error:', error)
    return json({ error: 'Не удалось отправить обращение' }, 500)
  }
})

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

function safeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 96)
}

async function sendEmailCopy({
  requestId,
  authorLine,
  tgLine,
  userId,
  email,
  pageUrl,
  message,
  attachmentName,
  attachmentSize,
}: {
  requestId: string
  authorLine: string
  tgLine: string
  userId: string
  email: string
  pageUrl: string
  message: string
  attachmentName: string
  attachmentSize: number
}): Promise<boolean> {
  if (!RESEND_API_KEY) return false

  const text = [
    'Новое обращение в поддержку Antigram',
    '',
    `ID: ${requestId}`,
    `От: ${authorLine}`,
    `User ID: ${userId}`,
    email ? `Email: ${email}` : '',
    tgLine ? `Telegram: ${tgLine}` : '',
    pageUrl ? `Страница: ${pageUrl}` : '',
    attachmentName ? `Вложение: ${attachmentName} (${Math.round(attachmentSize / 1024)} КБ)` : '',
    '',
    message || '(без текста)',
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SUPPORT_EMAIL_FROM,
      to: SUPPORT_EMAIL_TO,
      subject: `Antigram support: ${authorLine}`,
      text,
    }),
  })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    console.error('[Support] email copy failed:', body)
    return false
  }
  return true
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
