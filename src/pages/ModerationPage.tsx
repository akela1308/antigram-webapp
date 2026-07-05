import { useCallback, useEffect, useState } from 'react'
import type React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  adminDeleteMomentFromReport,
  adminShadowBanUserFromReport,
  getModerationReports,
  updateReportStatus,
} from '../lib/db'
import type { ModerationReport, ReportStatus } from '../lib/types'
import { getMomentImageUrl } from '../lib/imageVariants'

type FilterValue = ReportStatus | 'all'

export function ModerationPage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { language, t } = useLanguage()

  const [filter, setFilter] = useState<FilterValue>('open')
  const [reports, setReports] = useState<ModerationReport[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (authLoading) return
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const data = await getModerationReports(filter)
    setReports(data)
    setLoading(false)
  }, [authLoading, filter, profile?.is_admin])

  useEffect(() => {
    load()
  }, [load])

  const runAction = async (report: ModerationReport, action: () => Promise<{ error: unknown }>) => {
    setBusyId(report.id)
    setError(null)
    const { error: actionError } = await action()
    if (actionError) {
      console.error('[Moderation] action failed:', actionError)
      setError(t('moderation.actionFailed'))
    } else {
      await load()
    }
    setBusyId(null)
  }

  if (authLoading || loading) {
    return (
      <PageShell onBack={() => navigate(-1)} title={t('moderation.title')}>
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
      <PageShell onBack={() => navigate(-1)} title={t('moderation.title')}>
        <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center', fontSize: 14 }}>
          {t('moderation.adminOnly')}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell onBack={() => navigate(-1)} title={t('moderation.title')}>
      <div style={{ padding: '12px 14px 100px' }}>
        <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
          {(['open', 'reviewed', 'dismissed', 'actioned', 'all'] as FilterValue[]).map(item => (
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
              {t(`moderation.status.${item}`)}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: '#e05a5a', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
        )}

        {reports.length === 0 ? (
          <div style={{ padding: '64px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {t('moderation.empty')}
          </div>
        ) : (
          reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              language={language}
              busy={busyId === report.id}
              t={t}
              onReview={() => runAction(report, () => updateReportStatus(report.id, user.id, 'reviewed'))}
              onDismiss={() => runAction(report, () => updateReportStatus(report.id, user.id, 'dismissed'))}
              onDeleteMoment={report.reported_moment_id ? () => runAction(report, () => adminDeleteMomentFromReport(report.reported_moment_id!, user.id, report.id)) : undefined}
              onBanUser={report.reported_user_id ? () => runAction(report, () => adminShadowBanUserFromReport(report.reported_user_id!, user.id, report.id)) : undefined}
            />
          ))
        )}
      </div>
    </PageShell>
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

function ReportCard({ report, language, busy, t, onReview, onDismiss, onDeleteMoment, onBanUser }: {
  report: ModerationReport
  language: 'ru' | 'en'
  busy: boolean
  t: (key: string, params?: Record<string, string | number>) => string
  onReview: () => void
  onDismiss: () => void
  onDeleteMoment?: () => void
  onBanUser?: () => void
}) {
  const reporterName = report.reporter?.display_name || report.reporter?.username || t('common.someone')
  const reportedUser = report.reported_user ?? report.reported_moment?.profiles ?? null
  const reportedName = reportedUser?.display_name || reportedUser?.username || t('common.anonymous')
  const date = new Date(report.created_at).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US', {
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
        background: report.status === 'open' ? 'rgba(201,132,62,0.08)' : 'rgba(255,255,255,0.025)',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 800 }}>
            {t('moderation.reportType', { type: report.reported_moment_id ? t('moderation.moment') : t('moderation.profile') })}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 11 }}>
            {date}
          </p>
        </div>
        <span
          style={{
            flex: '0 0 auto',
            border: '1px solid #2E2218',
            borderRadius: 999,
            padding: '4px 8px',
            color: report.status === 'open' ? 'var(--amber)' : 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {t(`moderation.status.${report.status}`)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 12 }}>
        <PersonLine
          label={t('moderation.reporter')}
          profile={report.reporter}
          fallback={reporterName}
        />
        <PersonLine
          label={t('moderation.reportedUser')}
          profile={reportedUser}
          fallback={reportedName}
        />
      </div>

      <p style={{ margin: '12px 0 0', color: 'var(--text)', fontSize: 14, lineHeight: 1.45 }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('moderation.reason')}: </span>
        {t(`moderation.reason.${report.reason}`) === `moderation.reason.${report.reason}`
          ? report.reason
          : t(`moderation.reason.${report.reason}`)}
      </p>

      {report.reported_moment && (
        <Link
          to={`/moment/${report.reported_moment.id}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '56px minmax(0,1fr)',
            gap: 10,
            alignItems: 'center',
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: '1px solid #2E2218',
            textDecoration: 'none',
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <img
            src={getMomentImageUrl(report.reported_moment, 'thumb')}
            alt=""
            style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }}
            loading="lazy"
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: 'var(--amber)', fontSize: 13, fontWeight: 800 }}>{t('moderation.openMoment')}</p>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.reported_moment.caption || t('moment.reaction')}
            </p>
          </div>
        </Link>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {report.status === 'open' && (
          <>
            <ActionButton label={t('moderation.markReviewed')} disabled={busy} onClick={onReview} />
            <ActionButton label={t('moderation.dismiss')} disabled={busy} muted onClick={onDismiss} />
          </>
        )}
        {onDeleteMoment && (
          <ActionButton label={t('moderation.deleteMoment')} disabled={busy} danger onClick={onDeleteMoment} />
        )}
        {onBanUser && (
          <ActionButton label={t('moderation.banUser')} disabled={busy} danger onClick={onBanUser} />
        )}
      </div>
    </article>
  )
}

function PersonLine({ label, profile, fallback }: {
  label: string
  profile: ModerationReport['reporter']
  fallback: string
}) {
  return (
    <Link
      to={profile ? `/profile/${profile.id}` : '#'}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}
    >
      <Avatar url={profile?.avatar_url} name={fallback} size={34} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{label}</p>
        <p style={{ margin: '2px 0 0', color: '#fff', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fallback}
        </p>
      </div>
    </Link>
  )
}

function ActionButton({ label, disabled, danger, muted, onClick }: {
  label: string
  disabled: boolean
  danger?: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        padding: '0 12px',
        borderRadius: 999,
        border: danger ? '1px solid rgba(224,90,90,0.45)' : '1px solid #2E2218',
        background: muted ? 'transparent' : danger ? 'rgba(224,90,90,0.08)' : 'rgba(201,132,62,0.1)',
        color: danger ? '#e05a5a' : muted ? 'var(--text-muted)' : 'var(--amber)',
        fontSize: 12,
        fontWeight: 800,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  )
}
