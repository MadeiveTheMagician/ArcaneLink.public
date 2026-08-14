import { lazy, Suspense, useEffect, useState } from 'react'
import { configureApiAuthSession, apiJson, apiRequest } from './shared/api/api'
import { appCopy } from './shared/app.copy'
import {
  clearAuthSession,
  getCurrentAccessToken,
  getCurrentDeviceSessionId,
  getManagedAccessToken,
  persistAuthSession,
  refreshManagedAccessToken,
  restoreAuthSession,
  subscribeAuthSession,
} from './shared/auth/authSession'
import type {
  LoginResponse,
  ProfileSession,
  OwnUserProfileResponse,
  UserProfileSettingsResponse,
  UserResponse,
} from './shared/types'

const AuthPage = lazy(() =>
  import('./pages/Auth/AuthPage').then((module) => ({
    default: module.AuthPage,
  })),
)
const InvitePage = lazy(() =>
  import('./pages/Invite/InvitePage').then((module) => ({
    default: module.InvitePage,
  })),
)
const HubPage = lazy(() =>
  import('./system/Hub/components/shell/HubPage').then((module) => ({
    default: module.HubPage,
  })),
)

async function loadProfileSession(
  accessToken: string,
): Promise<ProfileSession> {
  const user = await apiJson<UserResponse>('/api/users/me', {
    accessToken,
  })

  const publicProfile = await apiJson<OwnUserProfileResponse>(
    '/api/users/me/profile',
    { accessToken: getCurrentAccessToken() ?? accessToken },
  )
  const profileSettings = await apiJson<UserProfileSettingsResponse>(
    '/api/users/me/profile/settings',
    { accessToken: getCurrentAccessToken() ?? accessToken },
  )

  return {
    accessToken: getCurrentAccessToken() ?? accessToken,
    refreshToken: '',
    deviceSessionId: getCurrentDeviceSessionId(),
    user,
    publicProfile,
    profileSettings,
  }
}

function AppLoading({ label = appCopy.loading.default }: { label?: string }) {
  return (
    <main className="app-loading">
      <img src="/brand/logo-mark.svg" alt="" />
      <span>{label}</span>
    </main>
  )
}

function App() {
  const [session, setSession] = useState<ProfileSession | null>(null)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const inviteCode = currentPath.match(/^\/invite\/([^/]+)$/)?.[1] ?? null

  useEffect(() => {
    configureApiAuthSession({
      getAccessToken: getManagedAccessToken,
      refreshAccessToken: refreshManagedAccessToken,
      onUnauthorized: () => {
        clearAuthSession()
        setSession(null)
      },
    })

    return subscribeAuthSession((nextAccessToken) => {
      setSession((currentSession) =>
        currentSession && nextAccessToken
          ? { ...currentSession, accessToken: nextAccessToken }
          : currentSession,
      )
    })
  }, [])

  useEffect(() => {
    function syncPath() {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', syncPath)

    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    void restoreAuthSession()
      .then((tokenPair) => loadProfileSession(tokenPair.accessToken))
      .then(setSession)
      .catch(() => {
        clearAuthSession()
        setSession(null)
      })
      .finally(() => setIsRestoringSession(false))
  }, [])

  async function handleAuthenticated(loginResponse: LoginResponse) {
    persistAuthSession(loginResponse)
    const nextSession = await loadProfileSession(
      loginResponse.accessToken,
    )

    setSession(nextSession)
  }

  async function handleLogout() {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: {},
    }).catch(() => undefined)

    clearAuthSession()
    setSession(null)
  }

  function navigateHome() {
    window.history.pushState({}, '', '/')
    setCurrentPath('/')
  }

  function handleInviteAccepted() {
    navigateHome()
  }

  if (isRestoringSession) {
    return (
      <main className="app-loading">
        <img src="/brand/logo-mark.svg" alt="" />
        <span>{appCopy.loading.restoringSession}</span>
      </main>
    )
  }

  if (inviteCode && session) {
    return (
      <Suspense fallback={<AppLoading />}>
        <InvitePage
          code={inviteCode}
          accessToken={session.accessToken}
          onAccepted={handleInviteAccepted}
          onDeclined={navigateHome}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<AppLoading />}>
      {session ? (
        <HubPage session={session} onLogout={handleLogout} />
      ) : (
        <AuthPage onAuthenticated={handleAuthenticated} />
      )}
    </Suspense>
  )
}

export default App

