import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { FeedPage } from './pages/FeedPage'
import { ExplorePage } from './pages/ExplorePage'
import { UploadPage } from './pages/UploadPage'
import { MomentPage } from './pages/MomentPage'
import { ProfilePage } from './pages/ProfilePage'
import { MyProfilePage } from './pages/MyProfilePage'
import { AuthPage } from './pages/AuthPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SearchPage } from './pages/SearchPage'
import { MomentFeedPage } from './pages/MomentFeedPage'
import { AlbumDetailPage } from './pages/AlbumDetailPage'
import { BottomNav } from './components/BottomNav'
import { MiniPlayer } from './components/MiniPlayer'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { trackSessionStart } from './lib/analytics'

export function App() {
  const { loading } = useAuth()
  const location = useLocation()

  useEffect(() => { trackSessionStart() }, [])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: '100dvh', background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--amber)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка...</span>
        </div>
      </div>
    )
  }

  const hideNav = location.pathname === '/upload'
    || location.pathname === '/moment-feed'
    || location.pathname.startsWith('/album/')
  const showMiniPlayer = !hideNav && location.pathname !== '/auth'

  return (
    <div
      className="mx-auto relative"
      style={{ maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', width: '100%', overflowX: 'clip' }}
    >
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/moment/:id" element={<MomentPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/me" element={<MyProfilePage />} />
        <Route path="/moment-feed" element={<MomentFeedPage />} />
        <Route path="/album/:albumId" element={<AlbumDetailPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
      {showMiniPlayer && <MiniPlayer />}
    </div>
  )
}
