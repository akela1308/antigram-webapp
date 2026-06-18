import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
        paddingTop: 10,
        paddingBottom: `max(10px, env(safe-area-inset-bottom, 10px))`,
      }}
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-4 py-1 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`
        }
      >
        {({ isActive }) => (
          <>
            <HomeIcon active={isActive} />
            <span style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)', fontSize: 10 }}>Лента</span>
          </>
        )}
      </NavLink>

      <NavLink
        to="/explore"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-4 py-1 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`
        }
      >
        {({ isActive }) => (
          <>
            <ExploreIcon active={isActive} />
            <span style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)', fontSize: 10 }}>Подборки</span>
          </>
        )}
      </NavLink>

      {/* Center camera FAB */}
      <button
        onClick={() => navigate(user ? '/upload' : '/auth')}
        className="flex flex-col items-center transition-transform active:scale-90"
        style={{ marginBottom: 2 }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'var(--amber)', marginTop: -22 }}
        >
          <CameraIcon />
        </div>
      </button>

      <NavLink
        to="/me"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 px-4 py-1 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`
        }
      >
        {({ isActive }) => (
          <>
            <MeIcon active={isActive} />
            <span style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)', fontSize: 10 }}>Я</span>
          </>
        )}
      </NavLink>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#140E0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function MeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </svg>
  )
}
