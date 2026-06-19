import { useState } from 'react'

export function SearchPage() {
  const [query, setQuery] = useState('')

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'var(--tg-top, 0px)' }}
    >
      <div
        className="sticky z-40"
        style={{
          top: 'var(--tg-top, 0px)',
          background: 'rgba(20,14,10,0.97)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-warm)',
            borderRadius: 20,
            padding: '9px 14px',
            border: '1px solid var(--border)',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск..."
            autoFocus
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 16,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
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
          style={{ opacity: 0.5 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Введите запрос для поиска
        </p>
      </div>
    </div>
  )
}
