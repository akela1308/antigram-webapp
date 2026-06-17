import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function BottomNav() {
  const { user } = useAuth()

  const items = [
    { to: '/', icon: HomeIcon, label: 'Лента' },
    { to: `/profile/${user?.id ?? ''}`, icon: UserIcon, label: 'Профиль', hide: !user },
    { to: '/me', icon: MeIcon, label: 'Я' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 safe-bottom flex justify-around items-center z-50"
      style={{
        background: 'rgba(20,14,10,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
        paddingBottom: `max(10px, env(safe-area-inset-bottom, 10px))`,
      }}
    >
      {items
        .filter(item => !item.hide)
        .map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-6 py-1 transition-all ${isActive ? 'opacity-100' : 'opacity-40'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon active={isActive} />
                <span className="text-xs" style={{ color: isActive ? 'var(--amber)' : 'var(--text-muted)', fontSize: 10 }}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
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

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function MeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--amber)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
