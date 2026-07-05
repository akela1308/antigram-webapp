import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  PREMIUM_ENABLED,
  PREMIUM_PRICE_STARS,
  PREMIUM_PERIOD_DAYS,
} from '../lib/premium'

const featureKeys = [
  'premium.feature.frames',
  'premium.feature.films',
  'premium.feature.highlights',
  'premium.feature.badge',
  'premium.feature.early',
  'premium.feature.support',
] as const

export function PremiumPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { entitlements, isPremium } = useAuth()
  const premiumUntil = entitlements?.premium_until
    ? new Date(entitlements.premium_until).toLocaleDateString()
    : null

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        padding: 'calc(var(--tg-top, 56px) + 14px) 16px 112px',
        color: 'var(--text)',
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 14,
          fontWeight: 700,
          padding: '0 0 18px',
          cursor: 'pointer',
        }}
      >
        ← {t('common.back')}
      </button>

      <section
        style={{
          borderRadius: 20,
          border: '1px solid rgba(201,132,62,0.28)',
          background: 'radial-gradient(circle at 50% 0%, rgba(201,132,62,0.22), rgba(20,14,10,0.92) 42%, #110C08)',
          padding: '24px 18px 18px',
          boxShadow: '0 22px 70px rgba(0,0,0,0.32)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            margin: '0 auto 16px',
            background: '#C4A882',
            color: '#1A0F05',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontWeight: 900,
            fontSize: 20,
            boxShadow: '0 0 34px rgba(201,132,62,0.34)',
          }}
        >
          [A]
        </div>
        <h1 style={{ color: '#fff', fontSize: 28, lineHeight: 1.08, fontWeight: 900, margin: 0, textAlign: 'center', fontFamily: 'Georgia, serif' }}>
          {t('premium.title')}
        </h1>
        <p style={{ color: 'rgba(243,224,193,0.72)', fontSize: 14, lineHeight: 1.5, margin: '10px auto 0', maxWidth: 310, textAlign: 'center' }}>
          {isPremium
            ? t('premium.activeSubtitle', {
              date: premiumUntil ?? t('premium.activeNoDate'),
              frames: entitlements?.daily_frame_limit ?? 8,
              highlights: entitlements?.highlight_limit ?? 10,
            })
            : t('premium.subtitle', { price: PREMIUM_PRICE_STARS, days: PREMIUM_PERIOD_DAYS })}
        </p>
      </section>

      <section style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {featureKeys.map(key => (
          <div
            key={key}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
              padding: '13px 14px',
              borderRadius: 14,
              border: '1px solid #2E1A0A',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'rgba(201,132,62,0.12)',
                color: 'var(--amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
              }}
            >
              ★
            </span>
            <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
              {t(key)}
            </span>
          </div>
        ))}
      </section>

      <button
        disabled={isPremium || !PREMIUM_ENABLED}
        style={{
          width: '100%',
          padding: '15px 0',
          borderRadius: 30,
          border: 'none',
          marginTop: 18,
          background: isPremium ? 'rgba(201,132,62,0.18)' : PREMIUM_ENABLED ? 'var(--amber)' : '#2E1A0A',
          color: isPremium ? 'var(--amber)' : PREMIUM_ENABLED ? '#140E0A' : 'var(--text-muted)',
          fontSize: 15,
          fontWeight: 900,
          cursor: isPremium || !PREMIUM_ENABLED ? 'not-allowed' : 'pointer',
        }}
      >
        {isPremium
          ? t('premium.active')
          : PREMIUM_ENABLED
          ? t('premium.buy', { price: PREMIUM_PRICE_STARS })
          : t('premium.comingSoon')}
      </button>

      <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.55, margin: '12px 4px 0', textAlign: 'center' }}>
        {t('premium.note')}
      </p>

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Link to="/terms" style={{ color: 'var(--amber)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          {t('settings.termsStars')}
        </Link>
      </div>
    </div>
  )
}
