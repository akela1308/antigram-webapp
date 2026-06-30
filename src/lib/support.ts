import { supabase } from './supabase'

export const SUPPORT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024

export async function sendSupportRequest(formData: FormData): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Нужно войти в аккаунт')
  }

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  const body = await res.json().catch(() => null) as { error?: string } | null

  if (!res.ok) {
    throw new Error(body?.error ?? 'Не удалось отправить обращение')
  }
}
