import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  STAR_SUPPORT_AMOUNTS,
  createStarInvoice,
  getMomentStarTotal,
  isStarSupportAmount,
  type StarSupportAmount,
} from '../lib/db'

type StarButtonVariant = 'inline' | 'overlay' | 'soft'

interface StarSupportButtonProps {
  momentId: string
  initialTotal?: number
  variant?: StarButtonVariant
  label?: string
  onTotalChange?: (total: number) => void
}

interface TelegramWebApp {
  openInvoice?: (url: string, callback?: (status: string) => void) => void
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
  }
}

export function StarSupportButton({
  momentId,
  initialTotal = 0,
  variant = 'soft',
  label,
  onTotalChange,
}: StarSupportButtonProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [total, setTotal] = useState(initialTotal)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<StarSupportAmount | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setTotal(initialTotal)
  }, [initialTotal])

  const openSheet = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      navigate('/auth')
      return
    }

    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('light')
    setMessage(null)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    if (pendingAmount) return
    setSheetOpen(false)
    setMessage(null)
  }

  const refreshTotalAfterPayment = async (amount: number) => {
    const expectedMinimum = total + amount

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 650 * attempt))
      }

      const nextTotal = await getMomentStarTotal(momentId)
      if (nextTotal >= expectedMinimum || attempt === 4) {
        setTotal(nextTotal)
        onTotalChange?.(nextTotal)
        return nextTotal
      }
    }

    return total
  }

  const handlePay = async (amount: number) => {
    if (!isStarSupportAmount(amount) || pendingAmount) return

    setPendingAmount(amount)
    setMessage(null)

    try {
      const invoice = await createStarInvoice(momentId, amount)
      const status = await openTelegramInvoice(invoice.invoiceLink)

      if (status === 'paid') {
        getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('success')
        const nextTotal = await refreshTotalAfterPayment(amount)
        setMessage(
          nextTotal >= total + amount
            ? 'Готово. Звезды засчитаны кадру.'
            : 'Платеж принят. Счетчик обновится чуть позже.',
        )
        setTimeout(() => {
          setSheetOpen(false)
          setMessage(null)
        }, 1200)
        return
      }

      if (status === 'cancelled') {
        setMessage('Оплата отменена.')
        return
      }

      if (status === 'opened') {
        setMessage('Счет открыт. После оплаты Stars появятся у кадра.')
        return
      }

      setMessage('Не удалось завершить оплату. Попробуйте еще раз.')
    } catch (error) {
      console.error('[Stars] invoice failed:', error)
      setMessage('Не получилось создать счет. Попробуйте позже.')
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.('error')
    } finally {
      setPendingAmount(null)
    }
  }

  const sheet = sheetOpen ? (
    <>
      <div
        onClick={closeSheet}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 260,
          background: 'rgba(0,0,0,0.68)',
          backdropFilter: 'blur(4px)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 261,
          background: '#110C08',
          borderRadius: '22px 22px 0 0',
          borderTop: '1px solid #2E2218',
          padding: '12px 18px max(26px, env(safe-area-inset-bottom, 20px))',
          boxShadow: '0 -16px 44px rgba(0,0,0,0.5)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: '#3A2A1E' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0 }}>
              Поддержать кадр
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45, margin: '5px 0 0' }}>
              Stars увеличивают рейтинг кадра и автора в Antigram.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            disabled={Boolean(pendingAmount)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              border: '1px solid #2E2218',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-muted)',
              fontSize: 20,
              cursor: pendingAmount ? 'default' : 'pointer',
              opacity: pendingAmount ? 0.5 : 1,
            }}
          >
            x
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 16 }}>
          {STAR_SUPPORT_AMOUNTS.map(amount => (
            <button
              key={amount}
              type="button"
              onClick={() => handlePay(amount)}
              disabled={Boolean(pendingAmount)}
              style={{
                minHeight: 58,
                borderRadius: 14,
                border: pendingAmount === amount ? '1px solid var(--amber)' : '1px solid #2E2218',
                background: pendingAmount === amount ? 'rgba(201,132,62,0.18)' : '#1A1208',
                color: pendingAmount ? 'var(--text-muted)' : '#F5E4C7',
                cursor: pendingAmount ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              <span style={{ color: 'var(--amber)', fontSize: 18, lineHeight: 1 }}>★</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{amount}</span>
            </button>
          ))}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.45, margin: '14px 2px 0' }}>
          Это добровольная поддержка и статус внутри приложения. Возможные выплаты, бонусы или premium-функции могут появиться позже
          отдельной программой и сейчас не гарантируются. Подробнее: <Link to="/terms" style={{ color: 'var(--amber)' }}>условия</Link>.
        </p>

        {message && (
          <p style={{ color: message.includes('Готово') ? 'var(--amber)' : 'var(--text-muted)', fontSize: 12, margin: '12px 2px 0' }}>
            {message}
          </p>
        )}
      </div>
    </>
  ) : null

  return (
    <>
      <button
        type="button"
        aria-label={`Поддержать кадр Stars, сейчас ${total}`}
        onClick={openSheet}
        style={getButtonStyle(variant)}
      >
        <span style={{ fontSize: variant === 'inline' ? 17 : 14, lineHeight: 1 }}>
          {total > 0 ? '★' : '☆'}
        </span>
        <span>{formatStars(total)}</span>
        {label && <span style={{ color: variant === 'overlay' ? 'rgba(255,255,255,0.72)' : 'var(--text-muted)' }}>{label}</span>}
      </button>
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  )
}

export function StarCountPill({
  total,
  compact = false,
  style,
}: {
  total: number
  compact?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      aria-label={`${total} Stars`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 4,
        minHeight: compact ? 22 : 26,
        padding: compact ? '3px 7px' : '4px 9px',
        borderRadius: 999,
        background: 'rgba(20,14,10,0.76)',
        border: '1px solid rgba(201,132,62,0.5)',
        color: 'var(--amber)',
        fontSize: compact ? 11 : 12,
        fontWeight: 800,
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        ...style,
      }}
    >
      <span style={{ lineHeight: 1 }}>{total > 0 ? '★' : '☆'}</span>
      <span>{formatStars(total)}</span>
    </div>
  )
}

function getButtonStyle(variant: StarButtonVariant): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  if (variant === 'overlay') {
    return {
      ...base,
      minHeight: 28,
      padding: '6px 10px',
      background: 'rgba(20,14,10,0.7)',
      border: '1px solid rgba(201,132,62,0.7)',
      color: 'var(--amber)',
      fontSize: 12,
      backdropFilter: 'blur(6px)',
      boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
    }
  }

  if (variant === 'inline') {
    return {
      ...base,
      minHeight: 38,
      padding: '9px 14px',
      background: 'rgba(201,132,62,0.14)',
      border: '1px solid rgba(201,132,62,0.45)',
      color: 'var(--amber)',
      fontSize: 13,
    }
  }

  return {
    ...base,
    minHeight: 30,
    padding: '7px 11px',
    background: 'rgba(201,132,62,0.1)',
    border: '1px solid rgba(201,132,62,0.35)',
    color: 'var(--amber)',
    fontSize: 12,
  }
}

function formatStars(total: number): string {
  if (total >= 1000) return `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}k`
  return String(total)
}

function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return ((window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp) ?? null
  } catch {
    return null
  }
}

function openTelegramInvoice(invoiceLink: string): Promise<string> {
  const tg = getTelegramWebApp()

  if (typeof tg?.openInvoice === 'function') {
    return new Promise(resolve => {
      tg.openInvoice?.(invoiceLink, status => resolve(status))
    })
  }

  window.open(invoiceLink, '_blank', 'noopener,noreferrer')
  return Promise.resolve('opened')
}
