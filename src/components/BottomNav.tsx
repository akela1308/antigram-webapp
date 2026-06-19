import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ACTIVE = '#C9843E'
const INACTIVE = '#8A6A50'

export function BottomNav() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex justify-around items-end z-50"
      style={{
        background: 'rgba(20,14,10,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        height: 85,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        paddingTop: 8,
      }}
    >
      <NavLink to="/" end className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
        {({ isActive }) => <HomeIcon active={isActive} />}
      </NavLink>

      <NavLink to="/search" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
        {({ isActive }) => <SearchIcon active={isActive} />}
      </NavLink>

      {/* Center [A] FAB */}
      <button
        onClick={() => navigate(user ? '/upload' : '/auth')}
        className="flex flex-col items-center justify-end pb-1 transition-transform active:scale-90"
        style={{ marginBottom: 4 }}
      >
        <div
          className="flex items-center justify-center rounded-full shadow-lg"
          style={{
            width: 56,
            height: 56,
            background: '#2E1A0A',
            marginTop: -20,
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 44,
              height: 44,
              background: '#C4A882',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                fontSize: 15,
                fontWeight: 700,
                color: '#1A0F05',
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              [A]
            </span>
          </div>
        </div>
      </button>

      <NavLink to="/notifications" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
        {({ isActive }) => <BellIcon active={isActive} />}
      </NavLink>

      <NavLink to="/me" className="flex flex-col items-center justify-end pb-1 px-4 transition-all">
        {({ isActive }) => <PersonIcon active={isActive} />}
      </NavLink>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function SearchIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function BellIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE : INACTIVE
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.5 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </svg>
  )
}
