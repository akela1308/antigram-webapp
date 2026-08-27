import { useCallback, useEffect, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { adminRefundPayment, getAdminPayments } from '../lib/db'
import type { AdminPayment } from '../lib/types'

type FilterValue = 'all' | 'moment' | 'premium'

export function PaymentsPage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { language } = useLanguage()
  const isRu = language === 'ru'

  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [filter, setFilter] = useState<FilterValue>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Возврат необратим, поэтому кнопка двухшаговая: первый тап просит подтвердить.
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (authLoading) return
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setPayments(await getAdminPayments(100))
    } catch (e) {
      console.error('[Payments] load failed:', e)
      setError(isRu ? 'Не удалось загрузить платежи' : 'Could not load payments')
    }
    setLoading(false)
  }, [authLoading, profile?.is_admin, isRu])

  useEffect(() => {
    load()
  }, [load])

  const handleRefund = async (payment: AdminPayment) => {
    if (confirmId !== payment.id) {
      setConfirmId(payment.id)
      return
    }

    setConfirmId(null)
    setBusyId(payment.id)
    setError(null)
    try {
      await adminRefundPayment(payment.kind, payment.id)
      await load()
    } catch (e) {
      console.error('[Payments] refund failed:', e)
      setError(
        e instanceof Error && e.message
          ? e.message
          : isRu ? 'Возврат не прошёл' : 'Refund failed',
      )
    }
    setBusyId(null)
  }

  const visible = payments.filter(p => filter === 'all' || p.kind === filter)
  const title = isRu ? 'Платежи' : 'Payments'

  if (authLoading || loading) {
    return (
      <PageShell title={title} onBack={() => navigate(-1)}>
        <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="rounded-full border-2 border-t-transparent animate-spin"
            style={{ width: 36, height: 36, borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
          />
        </div>
      </PageShell>
    )
  }

  if (!user || !profile?.is_admin) {
    return (
      <PageShell title={title} onBack={() => navigate(-1)}>
        <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center', fontSize: 14 }}>
          {isRu ? 'Раздел доступен только администраторам.' : 'This section is for admins only.'}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title={title} onBack={() => navigate(-1)}>
      <div style={{ padding: '12px 14px 100px' }}>
        <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          {(['all', 'moment', 'premium'] as FilterValue[]).map(item => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              style={{
                flex: '0 0 auto',
                height: 34,
                padding: '0 13px',
                borderRadius: 999,
                border: filter === item ? '1px solid var(--amber)' : '1px solid #2E2218',
                background: filter === item ? 'rgba(201,132,62,0.13)' : 'rgba(255,255,255,0.03)',
                color: filter === item ? 'var(--amber)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {item === 'all'
                ? (isRu ? 'Все' : 'All')
                : item === 'moment'
                ? (isRu ? 'Поддержка кадров' : 'Frame support')
                : 'Premium'}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: '#E06A5A', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>{error}</p>
        )}

        {visible.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
            {isRu ? 'Платежей пока нет.' : 'No payments yet.'}
          </p>
        ) : (
          visible.map(payment => (
            <PaymentCard
              key={`${payment.kind}_${payment.id}`}
              payment={payment}
              isRu={isRu}
              busy={busyId === payment.id}
              confirming={confirmId === payment.id}
              onRefund={() => handleRefund(payment)}
            />
          ))
        )}
      </div>
    </PageShell>
  )
}

function PaymentCard({ payment, isRu, busy, confirming, onRefund }: {
  payment: AdminPayment
  isRu: boolean
  busy: boolean
  confirming: boolean
  onRefund: () => void
}) {
  const refunded = payment.status === 'refunded'
  const date = new Date(payment.created_at).toLocaleString(isRu ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <article
      style={{
        border: '1px solid #2E2218',
        borderRadius: 14,
        background: refunded ? 'rgba(255,255,255,0.025)' : 'rgba(201,132,62,0.08)',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, fontWeight: 800 }}>
            {payment.kind === 'premium'
              ? 'Antigram Premium'
              : (isRu ? 'Поддержка кадра' : 'Frame support')}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
            {payment.payer_name}
            {payment.kind === 'moment' && ` → ${payment.counterparty_name}`}
            {' · '}
            {date}
          </p>
        </div>
        <span style={{ color: 'var(--amber)', fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' }}>
          {payment.amount} ★
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: refunded ? 'var(--text-muted)' : 'var(--amber)',
            border: '1px solid #2E2218',
            borderRadius: 999,
            padding: '4px 10px',
          }}
        >
          {refunded ? (isRu ? 'Возвращено' : 'Refunded') : payment.status}
        </span>

        {!refunded && (
          <button
            onClick={onRefund}
            disabled={busy}
            style={{
              marginLeft: 'auto',
              height: 34,
              padding: '0 14px',
              borderRadius: 999,
              border: confirming ? '1px solid #E06A5A' : '1px solid #2E2218',
              background: confirming ? 'rgba(224,106,90,0.15)' : 'rgba(255,255,255,0.03)',
              color: confirming ? '#E06A5A' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 800,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy
              ? (isRu ? 'Возвращаю…' : 'Refunding…')
              : confirming
              ? (isRu ? 'Точно вернуть?' : 'Confirm refund?')
              : (isRu ? 'Вернуть звёзды' : 'Refund Stars')}
          </button>
        )}
      </div>
    </article>
  )
}

function PageShell({ title, children, onBack }: {
  title: string
  children: React.ReactNode
  onBack: () => void
}) {
  return (
    <div style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)', background: 'var(--bg)' }}>
      <div
        style={{
          position: 'sticky',
          top: 'var(--tg-top, 56px)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'rgba(20,14,10,0.97)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button onClick={onBack} style={{ width: 34, height: 34, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>
          ‹
        </button>
        <h1 style={{ margin: 0, color: 'var(--brown)', fontSize: 18, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
          {title}
        </h1>
      </div>
      {children}
    </div>
  )
}
