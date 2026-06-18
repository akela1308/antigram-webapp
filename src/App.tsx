import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { FeedPage } from './pages/FeedPage'
import { ExplorePage } from './pages/ExplorePage'
import { UploadPage } from './pages/UploadPage'
import { MomentPage } from './pages/MomentPage'
import { ProfilePage } from './pages/ProfilePage'
import { MyProfilePage } from './pages/MyProfilePage'
import { AuthPage } from './pages/AuthPage'
import { BottomNav } from './components/BottomNav'

export function App() {
  const { loading } = useAuth()

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

  return (
    <div
      className="mx-auto relative"
      style={{ maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)' }}
    >
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/moment/:id" element={<MomentPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/me" element={<MyProfilePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
