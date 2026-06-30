import { supabase } from './supabase'
import type { Profile } from './types'

export const SUPPORT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024

export interface SupportRequest {
  id: string
  reporter_id: string
  message: string
  attachment_bucket: string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
  page_url: string | null
  metadata: Record<string, unknown>
  status: 'open' | 'closed'
  created_at: string
  updated_at: string
  profiles: Profile | null
}

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

export async function getSupportRequests(): Promise<SupportRequest[]> {
  const { data, error } = await supabase
    .from('support_requests')
    .select('*, profiles:profiles!support_requests_reporter_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data as SupportRequest[] | null) ?? []
}

export async function getOpenSupportRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  if (error) throw error
  return count ?? 0
}

export async function updateSupportRequestStatus(
  id: string,
  status: 'open' | 'closed',
): Promise<void> {
  const { error } = await supabase
    .from('support_requests')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

export async function getSupportAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(path, 60 * 10)

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Не удалось открыть вложение')
  }

  return data.signedUrl
}
