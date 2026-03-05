import { useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import type { GoogleUser } from './Auth'
import { Auth, loadPersistedSession, clearPersistedSession } from './Auth'
import { ActivityLog } from './ActivityLog'
import { useTheme } from './lib/theme'
import { ThemeToggle } from './ThemeToggle'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function App() {
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<GoogleUser | null>(loadPersistedSession)

  if (!clientId) {
    return (
      <div className="loading">
        <span>Missing VITE_GOOGLE_CLIENT_ID. Check your .env file.</span>
      </div>
    )
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="theme-bar">
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>
      {!user ? (
        <Auth onSignIn={setUser} />
      ) : (
        <ActivityLog user={user} onSignOut={() => { clearPersistedSession(); setUser(null) }} />
      )}
    </GoogleOAuthProvider>
  )
}
