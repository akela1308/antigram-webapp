// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60
const INIT_DATA_MAX_FUTURE_SKEW_SECONDS = 5 * 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

interface TelegramAuthResult {
  user: TelegramUser | null
  error?: string
}

type SupabaseAdmin = ReturnType<typeof createClient>

function hexToBytes(hex: string): Uint8Array | null {
  const normalized = hex.trim().toLowerCase()
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]+$/.test(normalized)) return null

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16)
  }
  return bytes
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aBytes = hexToBytes(a)
  const bBytes = hexToBytes(b)
  if (!aBytes || !bBytes) return false

  let diff = aBytes.length ^ bBytes.length
  const length = Math.max(aBytes.length, bBytes.length)
  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }

  return diff === 0
}

async function verifyTelegramInitData(initData: string, botToken: string): Promise<TelegramAuthResult> {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return { user: null, error: 'hash required' }

    params.delete('hash')
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const encoder = new TextEncoder()
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const keyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken))
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString))
    const computedHash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (!timingSafeEqualHex(computedHash, hash)) {
      return { user: null, error: 'Invalid initData signature' }
    }

    const authDateRaw = params.get('auth_date')
    const authDate = Number(authDateRaw)
    if (!authDateRaw || !Number.isFinite(authDate)) {
      return { user: null, error: 'auth_date required' }
    }

    const now = Math.floor(Date.now() / 1000)
    if (authDate > now + INIT_DATA_MAX_FUTURE_SKEW_SECONDS) {
      return { user: null, error: 'auth_date is in the future' }
    }
    if (now - authDate > INIT_DATA_MAX_AGE_SECONDS) {
      return { user: null, error: 'initData expired' }
    }

    const userStr = params.get('user')
    if (!userStr) return { user: null, error: 'user required' }
    return { user: JSON.parse(userStr) as TelegramUser }
  } catch {
    return { user: null, error: 'Invalid initData' }
  }
}

async function createSessionForEmail(admin: SupabaseAdmin, email: string) {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    return { session: null, error: linkError ?? new Error('Magic link token missing') }
  }

  const { data, error } = await admin.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })

  return { session: data.session ?? null, error }
}

async function upsertTelegramIdentity(
  admin: SupabaseAdmin,
  userId: string,
  tgUser: TelegramUser,
) {
  await admin
    .from('account_identities')
    .upsert({
      user_id: userId,
      provider: 'telegram',
      external_id: String(tgUser.id),
      metadata: {
        username: tgUser.username ?? null,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        photo_url: tgUser.photo_url ?? null,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider,external_id' })
}

function getStartParam(initData: string): string | null {
  const value = new URLSearchParams(initData).get('start_param')?.trim() ?? ''
  return value.length > 0 && value.length <= 128 ? value : null
}

function getReferralCodeFromStartParam(startParam: string | null): string | null {
  if (!startParam) return null
  const match = startParam.match(/(?:^|_)ref_([a-zA-Z0-9_-]{4,24})$/)
  return match?.[1]?.toLowerCase() ?? null
}

async function recordReferralOpen(
  admin: SupabaseAdmin,
  inviteeId: string,
  startParam: string | null,
) {
  const referralCode = getReferralCodeFromStartParam(startParam)
  if (!referralCode) return

  const { error } = await admin.rpc('record_referral_open', {
    p_invitee_id: inviteeId,
    p_referral_code: referralCode,
    p_start_param: startParam,
  })
  if (error) console.error('[Referral] record open failed:', error)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!BOT_TOKEN) {
      return new Response(JSON.stringify({ error: 'BOT_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { initData } = await req.json() as { initData: string }

    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify Telegram signature
    const tgAuth = await verifyTelegramInitData(initData, BOT_TOKEN)
    if (!tgAuth.user) {
      return new Response(JSON.stringify({ error: tgAuth.error ?? 'Invalid initData signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const tgUser = tgAuth.user
    const startParam = getStartParam(initData)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Synthetic credentials for Telegram users
    const email = `tg${tgUser.id}@antigram.internal`
    const password = `tg_${tgUser.id}_${BOT_TOKEN.slice(0, 8)}`
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')

    // Preferred path: stable identity lookup. This keeps Telegram login working
    // even after a user links a real email/password to the same auth account.
    const { data: linkedIdentity } = await supabaseAdmin
      .from('account_identities')
      .select('user_id')
      .eq('provider', 'telegram')
      .eq('external_id', String(tgUser.id))
      .maybeSingle()

    if (linkedIdentity?.user_id) {
      const { data: linkedUser, error: linkedUserError } = await supabaseAdmin.auth.admin.getUserById(linkedIdentity.user_id)
      const linkedEmail = linkedUser?.user?.email
      if (!linkedUserError && linkedEmail) {
        const sessionResult = await createSessionForEmail(supabaseAdmin, linkedEmail)
        if (sessionResult.session) {
          const profileUpdate: Record<string, string | null> = {
            display_name: displayName,
            username: tgUser.username ?? null,
          }
          if (tgUser.photo_url) profileUpdate.avatar_url = tgUser.photo_url
          await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', linkedIdentity.user_id)
          await upsertTelegramIdentity(supabaseAdmin, linkedIdentity.user_id, tgUser)
          await recordReferralOpen(supabaseAdmin, linkedIdentity.user_id, startParam)

          return new Response(
            JSON.stringify({
              access_token: sessionResult.session.access_token,
              refresh_token: sessionResult.session.refresh_token,
              user_id: linkedIdentity.user_id,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }
    }

    // Try sign in first (fast path for returning users)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError && signInData.session) {
      // Returning user — update profile (including avatar_url so it stays fresh)
      const profileUpdate: Record<string, string | null> = {
        display_name: displayName,
        username: tgUser.username ?? null,
      }
      if (tgUser.photo_url) {
        profileUpdate.avatar_url = tgUser.photo_url
      }
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', signInData.session.user.id)
      await upsertTelegramIdentity(supabaseAdmin, signInData.session.user.id, tgUser)
      await recordReferralOpen(supabaseAdmin, signInData.session.user.id, startParam)

      return new Response(
        JSON.stringify({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          user_id: signInData.session.user.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // New user — create auth account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        telegram_id: tgUser.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        username: tgUser.username,
      },
    })

    if (createError || !newUser?.user) {
      return new Response(JSON.stringify({ error: `Failed to create user: ${createError?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create profile
    await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      display_name: displayName,
      username: tgUser.username ?? null,
      avatar_url: tgUser.photo_url ?? null,
    })
    await upsertTelegramIdentity(supabaseAdmin, newUser.user.id, tgUser)
    await recordReferralOpen(supabaseAdmin, newUser.user.id, startParam)

    // Sign in to get session tokens
    const { data: newSignIn, error: newSignInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (newSignInError || !newSignIn.session) {
      return new Response(JSON.stringify({ error: `Sign-in after create failed: ${newSignInError?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        access_token: newSignIn.session.access_token,
        refresh_token: newSignIn.session.refresh_token,
        user_id: newUser.user.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
