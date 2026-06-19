export function NotificationsPage() {
  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 56px)' }}
    >
      <div
        className="sticky z-40"
        style={{
          top: 'var(--tg-top, 56px)',
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 16px',
        }}
      >
        <h1
          style={{
            color: 'var(--brown)',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 0.3,
            margin: 0,
            fontFamily: 'Georgia, serif',
          }}
        >
          Уведомления
        </h1>
      </div>

      <div
        className="flex flex-col items-center justify-center"
        style={{ flex: 1, padding: '48px 24px', gap: 12, textAlign: 'center' }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.5 }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: 14,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Скоро появятся уведомления
        </p>
      </div>
    </div>
  )
}
