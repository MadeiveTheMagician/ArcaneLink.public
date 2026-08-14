import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { readJsonResponse } from '../../shared/api/api'
import type {
  LoginResponse,
  PublicUserProfileResponse,
  UserDeviceSessionResponse,
  UserResponse,
} from '../../shared/types'
import styles from './ApiTestPage.module.css'

type ApiLogEntry = {
  id: number
  title: string
  status: 'ok' | 'error'
  detail: string
}

type TestUserForm = {
  login: string
  displayName: string
  email: string
  password: string
  loginOrEmail: string
  deviceName: string
}

type ProfileForm = {
  displayName: string
  bio: string
  websiteUrl: string
}

const defaultPassword = 'TestPass123!'

function createDefaultUser(): TestUserForm {
  const suffix = new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(4, 14)

  return {
    login: `api_test_${suffix}`,
    displayName: `API Test ${suffix}`,
    email: `api_test_${suffix}@example.com`,
    password: defaultPassword,
    loginOrEmail: `api_test_${suffix}`,
    deviceName: 'ArcaneLink API Test Page',
  }
}

function formatPayload(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function ApiTestPage() {
  const initialUser = useMemo(() => createDefaultUser(), [])
  const [form, setForm] = useState<TestUserForm>(initialUser)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    displayName: initialUser.displayName,
    bio: 'Profile updated from API test page.',
    websiteUrl: 'https://example.com',
  })
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null)
  const [log, setLog] = useState<ApiLogEntry[]>([])
  const [isBusy, setIsBusy] = useState(false)

  const authHeaders = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined

  function updateForm(field: keyof TestUserForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateProfileForm(field: keyof ProfileForm, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function pushLog(title: string, status: ApiLogEntry['status'], detail: unknown) {
    setLog((current) => [
      {
        id: Date.now(),
        title,
        status,
        detail: typeof detail === 'string' ? detail : formatPayload(detail),
      },
      ...current,
    ])
  }

  async function runStep<T>(
    title: string,
    request: () => Promise<T>,
  ): Promise<T | null> {
    setIsBusy(true)

    try {
      const result = await request()
      pushLog(title, 'ok', result ?? 'OK')
      return result
    } catch (error) {
      pushLog(
        title,
        'error',
        error instanceof Error ? error.message : 'Request failed.',
      )
      return null
    } finally {
      setIsBusy(false)
    }
  }

  async function ping() {
    await runStep('GET /ping', async () => {
      const response = await fetch('/ping')
      return response.text()
    })
  }

  async function register(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const user = await runStep('POST /api/auth/register', async () => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: form.login,
          displayName: form.displayName,
          email: form.email,
          password: form.password,
        }),
      })

      return readJsonResponse<UserResponse>(response)
    })

    if (user) {
      setCurrentUser(user)
      updateForm('loginOrEmail', user.login)
    }
  }

  async function login() {
    const response = await runStep('POST /api/auth/login', async () => {
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginOrEmail: form.loginOrEmail,
          password: form.password,
          deviceName: form.deviceName,
        }),
      })

      return readJsonResponse<LoginResponse>(loginResponse)
    })

    if (response) {
      setAccessToken(response.accessToken)
      setRefreshToken(response.refreshToken)
    }
  }

  async function loadMe() {
    const user = await runStep('GET /api/users/me', async () => {
      const response = await fetch('/api/users/me', {
        headers: authHeaders,
      })

      return readJsonResponse<UserResponse>(response)
    })

    if (user) {
      setCurrentUser(user)
    }
  }

  async function loadPublicProfile() {
    const userId = currentUser?.id

    if (!userId) {
      pushLog('GET /api/users/{id}', 'error', 'Load /me first.')
      return
    }

    await runStep('GET /api/users/{id}', async () => {
      const response = await fetch(`/api/users/${userId}`)
      return readJsonResponse<PublicUserProfileResponse>(response)
    })
  }

  async function updateProfile() {
    await runStep('PATCH /api/users/me/profile', async () => {
      const response = await fetch('/api/users/me/profile', {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: profileForm.displayName,
          bio: profileForm.bio,
          websiteUrl: profileForm.websiteUrl,
        }),
      })

      return readJsonResponse<PublicUserProfileResponse>(response)
    })
  }

  async function refresh() {
    const response = await runStep('POST /api/auth/refresh', async () => {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      })

      return readJsonResponse<LoginResponse>(refreshResponse)
    })

    if (response) {
      setAccessToken(response.accessToken)
      setRefreshToken(response.refreshToken)
    }
  }

  async function loadSessions() {
    await runStep('GET /api/auth/sessions', async () => {
      const response = await fetch('/api/auth/sessions', {
        headers: authHeaders,
      })

      return readJsonResponse<UserDeviceSessionResponse[]>(response)
    })
  }

  async function logout() {
    await runStep('POST /api/auth/logout', async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      })

      if (!response.ok) {
        await readJsonResponse<unknown>(response)
      }

      setAccessToken('')
      setRefreshToken('')
      return 'Logged out.'
    })
  }

  async function runHappyPath() {
    await ping()
    await register()
    await login()
    await loadMe()
    await loadPublicProfile()
    await updateProfile()
    await loadSessions()
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p>ArcaneLink</p>
            <h1>API Test Console</h1>
          </div>
          <a href="/">Back to app</a>
        </header>

        <section className={styles.grid}>
          <form className={styles.panel} onSubmit={register}>
            <h2>Test user</h2>
            <label>
              Login
              <input
                name="login"
                value={form.login}
                onChange={(event) => updateForm('login', event.target.value)}
              />
            </label>
            <label>
              Display name
              <input
                name="displayName"
                value={form.displayName}
                onChange={(event) =>
                  updateForm('displayName', event.target.value)
                }
              />
            </label>
            <label>
              Email
              <input
                name="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={(event) => updateForm('password', event.target.value)}
              />
            </label>
            <label>
              Login or email
              <input
                name="loginOrEmail"
                value={form.loginOrEmail}
                onChange={(event) =>
                  updateForm('loginOrEmail', event.target.value)
                }
              />
            </label>
            <label>
              Device name
              <input
                name="deviceName"
                value={form.deviceName}
                onChange={(event) =>
                  updateForm('deviceName', event.target.value)
                }
              />
            </label>
            <button type="submit" disabled={isBusy}>
              Register
            </button>
          </form>

          <section className={styles.panel}>
            <h2>Profile patch</h2>
            <label>
              Display name
              <input
                name="profileDisplayName"
                value={profileForm.displayName}
                onChange={(event) =>
                  updateProfileForm('displayName', event.target.value)
                }
              />
            </label>
            <label>
              Bio
              <textarea
                name="profileBio"
                value={profileForm.bio}
                onChange={(event) =>
                  updateProfileForm('bio', event.target.value)
                }
              />
            </label>
            <label>
              Website URL
              <input
                name="profileWebsiteUrl"
                value={profileForm.websiteUrl}
                onChange={(event) =>
                  updateProfileForm('websiteUrl', event.target.value)
                }
              />
            </label>
            <button type="button" disabled={isBusy} onClick={updateProfile}>
              Patch profile
            </button>
          </section>

          <section className={`${styles.panel} ${styles.actions}`}>
            <h2>Requests</h2>
            <button type="button" disabled={isBusy} onClick={runHappyPath}>
              Run happy path
            </button>
            <button type="button" disabled={isBusy} onClick={ping}>
              GET /ping
            </button>
            <button type="button" disabled={isBusy} onClick={login}>
              Login
            </button>
            <button type="button" disabled={isBusy} onClick={loadMe}>
              Load me
            </button>
            <button type="button" disabled={isBusy} onClick={loadPublicProfile}>
              Public profile
            </button>
            <button type="button" disabled={isBusy} onClick={refresh}>
              Refresh token
            </button>
            <button type="button" disabled={isBusy} onClick={loadSessions}>
              Sessions
            </button>
            <button type="button" disabled={isBusy} onClick={logout}>
              Logout
            </button>
          </section>
        </section>

        <section className={`${styles.panel} ${styles.session}`}>
          <h2>Current tokens</h2>
          <dl>
            <div>
              <dt>User ID</dt>
              <dd>{currentUser?.id || 'none'}</dd>
            </div>
            <div>
              <dt>Access token</dt>
              <dd>{accessToken ? `${accessToken.slice(0, 32)}...` : 'none'}</dd>
            </div>
            <div>
              <dt>Refresh token</dt>
              <dd>
                {refreshToken ? `${refreshToken.slice(0, 32)}...` : 'none'}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.log}>
          <h2>Log</h2>
          {log.length === 0 ? (
            <p>No requests yet.</p>
          ) : (
            log.map((entry) => (
              <article
                key={entry.id}
                className={`${styles.logEntry} ${entry.status === 'ok' ? styles.isOk : styles.isError}`}
              >
                <h3>{entry.title}</h3>
                <pre>{entry.detail}</pre>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  )
}
