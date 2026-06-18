// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''

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

async function verifyTelegramInitData(initData: string, botToken: string): Promise<TelegramUser | null> {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

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

    if (computedHash !== hash) return null

    const userStr = params.get('user')
    if (!userStr) return null
    return JSON.parse(userStr) as TelegramUser
  } catch {
    return null
  }
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
    const tgUser = await verifyTelegramInitData(initData, BOT_TOKEN)
    if (!tgUser) {
      return new Response(JSON.stringify({ error: 'Invalid initData signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Synthetic credentials for Telegram users
    const email = `tg${tgUser.id}@antigram.internal`
    const password = `tg_${tgUser.id}_${BOT_TOKEN.slice(0, 8)}`
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')

    // Try sign in first (fast path for returning users)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError && signInData.session) {
      // Returning user — update profile and return session
      await supabaseAdmin.from('profiles').update({
        display_name: displayName,
        username: tgUser.username ?? null,
      }).eq('id', signInData.session.user.id)

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
