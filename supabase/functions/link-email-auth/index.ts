// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Authorization required' }, 401)

    const { email: rawEmail, password } = await req.json() as {
      email?: string
      password?: string
    }

    const email = normalizeEmail(rawEmail ?? '')
    if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400)
    if (!password || password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)
    if (email.endsWith('@antigram.internal')) return json({ error: 'This email cannot be used' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authData, error: userError } = await admin.auth.getUser(token)
    if (userError || !authData.user) return json({ error: 'Invalid session' }, 401)

    const user = authData.user
    const existingEmail = user.email?.toLowerCase() ?? ''
    const isChangingEmail = existingEmail !== email

    if (isChangingEmail) {
      const { data: existingIdentity } = await admin
        .from('account_identities')
        .select('user_id')
        .eq('provider', 'email')
        .eq('external_id', email)
        .maybeSingle()

      if (existingIdentity && existingIdentity.user_id !== user.id) {
        return json({ error: 'Email is already linked to another account' }, 409)
      }
    }

    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        email_login_enabled: true,
      },
    })

    if (updateError || !updated.user) {
      return json({ error: updateError?.message ?? 'Could not link email' }, 400)
    }

    const identities = [
      {
        user_id: user.id,
        provider: 'email',
        external_id: email,
        metadata: { linked_from: existingEmail.endsWith('@antigram.internal') ? 'telegram' : 'account' },
        updated_at: new Date().toISOString(),
      },
    ]

    const telegramId = user.user_metadata?.telegram_id
    if (telegramId !== undefined && telegramId !== null) {
      identities.push({
        user_id: user.id,
        provider: 'telegram',
        external_id: String(telegramId),
        metadata: {
          username: user.user_metadata?.username ?? null,
          first_name: user.user_metadata?.first_name ?? null,
          last_name: user.user_metadata?.last_name ?? null,
        },
        updated_at: new Date().toISOString(),
      })
    }

    const { error: identityError } = await admin
      .from('account_identities')
      .upsert(identities, { onConflict: 'provider,external_id' })

    if (identityError) {
      return json({ error: identityError.message }, 500)
    }

    return json({ ok: true, email })
  } catch (error) {
    return json({ error: `Unexpected: ${String(error)}` }, 500)
  }
})
