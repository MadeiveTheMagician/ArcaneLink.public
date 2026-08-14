import { apiJson } from '../../../../shared/api/api'

const defaultRefreshLeewayMs = 30_000
const defaultMinimumValidityMs = 10_000
const defaultRefreshRetryDelayMs = 10_000
const refreshLifetimeRatio = 0.8

export type VoiceIceServerResponse = {
  iceServers: Array<{
    urls: string[]
    username: string
    credential: string
    credentialType: 'password'
  }>
  iceTransportPolicy: 'relay'
  expiresAt: string
}

export type VoiceIceCredentials = {
  iceServers: RTCIceServer[]
  iceTransportPolicy: 'relay'
  expiresAt: number
}

type VoiceIceCredentialsRequest = {
  accessToken: string
  cacheScope: string
}

type VoiceIceCredentialsClientOptions = {
  fetchCredentials?: (
    accessToken: string,
  ) => Promise<unknown>
  now?: () => number
  minimumValidityMs?: number
  refreshLeewayMs?: number
  refreshRetryDelayMs?: number
}

type CachedVoiceIceCredentials = VoiceIceCredentials & {
  cacheScope: string
  refreshAt: number
}

export class VoiceIceCredentialsError extends Error {
  readonly code:
    | 'request_failed'
    | 'invalid_response'
    | 'credentials_expired'

  constructor(
    code: VoiceIceCredentialsError['code'],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'VoiceIceCredentialsError'
    this.code = code
  }
}

export class VoiceIceCredentialsClient {
  private readonly fetchCredentials: (accessToken: string) => Promise<unknown>
  private readonly now: () => number
  private readonly minimumValidityMs: number
  private readonly refreshLeewayMs: number
  private readonly refreshRetryDelayMs: number
  private generation = 0
  private cached: CachedVoiceIceCredentials | null = null
  private pending: {
    cacheScope: string
    promise: Promise<VoiceIceCredentials>
  } | null = null

  constructor(options: VoiceIceCredentialsClientOptions = {}) {
    this.fetchCredentials =
      options.fetchCredentials ?? requestVoiceIceCredentials
    this.now = options.now ?? Date.now
    this.minimumValidityMs =
      options.minimumValidityMs ?? defaultMinimumValidityMs
    this.refreshLeewayMs =
      options.refreshLeewayMs ?? defaultRefreshLeewayMs
    this.refreshRetryDelayMs =
      options.refreshRetryDelayMs ?? defaultRefreshRetryDelayMs
  }

  async get({
    accessToken,
    cacheScope,
  }: VoiceIceCredentialsRequest): Promise<VoiceIceCredentials> {
    const normalizedCacheScope = cacheScope.trim()
    if (!accessToken.trim() || !normalizedCacheScope) {
      throw new VoiceIceCredentialsError(
        'request_failed',
        'An authenticated session is required to request TURN credentials.',
      )
    }

    const now = this.now()
    const cached = this.cached
    if (
      cached?.cacheScope === normalizedCacheScope &&
      now < cached.refreshAt
    ) {
      return toPublicCredentials(cached)
    }

    if (this.pending?.cacheScope === normalizedCacheScope) {
      return this.pending.promise
    }

    const promise = this.refresh(
      accessToken,
      normalizedCacheScope,
      cached?.cacheScope === normalizedCacheScope ? cached : null,
      this.generation,
    )
    this.pending = { cacheScope: normalizedCacheScope, promise }

    try {
      return await promise
    } finally {
      if (this.pending?.promise === promise) {
        this.pending = null
      }
    }
  }

  clear() {
    this.generation += 1
    this.cached = null
    this.pending = null
  }

  private async refresh(
    accessToken: string,
    cacheScope: string,
    previous: CachedVoiceIceCredentials | null,
    generation: number,
  ) {
    try {
      const response = await this.fetchCredentials(accessToken)
      const fetchedAt = this.now()
      const credentials = parseVoiceIceCredentialsResponse(
        response,
        fetchedAt,
        this.minimumValidityMs,
      )
      const lifetimeMs = credentials.expiresAt - fetchedAt
      const refreshAt = Math.min(
        credentials.expiresAt - this.refreshLeewayMs,
        fetchedAt + lifetimeMs * refreshLifetimeRatio,
      )

      const nextCached = {
        ...credentials,
        cacheScope,
        refreshAt: Math.max(fetchedAt, refreshAt),
      }
      if (this.generation === generation) {
        this.cached = nextCached
      }

      return toPublicCredentials(nextCached)
    } catch (error) {
      const now = this.now()
      if (previous && previous.expiresAt - now > this.minimumValidityMs) {
        if (this.generation === generation && this.cached === previous) {
          previous.refreshAt = Math.min(
            previous.expiresAt - this.minimumValidityMs,
            now + this.refreshRetryDelayMs,
          )
        }
        return toPublicCredentials(previous)
      }

      if (error instanceof VoiceIceCredentialsError) {
        throw error
      }

      throw new VoiceIceCredentialsError(
        'request_failed',
        'TURN credentials are temporarily unavailable.',
        { cause: error },
      )
    }
  }
}

export function parseVoiceIceCredentialsResponse(
  value: unknown,
  now = Date.now(),
  minimumValidityMs = defaultMinimumValidityMs,
): VoiceIceCredentials {
  if (!isRecord(value) || value.iceTransportPolicy !== 'relay') {
    throw invalidResponse()
  }

  const expiresAt = Date.parse(
    typeof value.expiresAt === 'string' ? value.expiresAt : '',
  )
  if (!Number.isFinite(expiresAt)) {
    throw invalidResponse()
  }
  if (expiresAt - now <= minimumValidityMs) {
    throw new VoiceIceCredentialsError(
      'credentials_expired',
      'The TURN credentials are expired or too close to expiration.',
    )
  }

  if (!Array.isArray(value.iceServers) || value.iceServers.length === 0) {
    throw invalidResponse()
  }

  const iceServers = value.iceServers.map((server) => {
    if (!isRecord(server)) {
      throw invalidResponse()
    }

    const urls = server.urls
    if (
      !Array.isArray(urls) ||
      urls.length === 0 ||
      !urls.every(isTurnUrl)
    ) {
      throw invalidResponse()
    }

    if (
      typeof server.username !== 'string' ||
      !server.username.trim() ||
      typeof server.credential !== 'string' ||
      !server.credential ||
      server.credentialType !== 'password'
    ) {
      throw invalidResponse()
    }

    return {
      urls: [...urls],
      username: server.username,
      credential: server.credential,
      credentialType: 'password' as const,
    }
  })

  return {
    iceServers,
    iceTransportPolicy: 'relay',
    expiresAt,
  }
}

async function requestVoiceIceCredentials(accessToken: string) {
  return await apiJson<VoiceIceServerResponse>('/api/voice/ice-servers', {
    accessToken,
    cache: 'no-store',
  })
}

function isTurnUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(turn|turns):/i.test(value.trim())
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function invalidResponse() {
  return new VoiceIceCredentialsError(
    'invalid_response',
    'The server returned an invalid TURN credentials response.',
  )
}

function toPublicCredentials(
  cached: CachedVoiceIceCredentials,
): VoiceIceCredentials {
  return {
    iceServers: cached.iceServers.map((server) => ({
      ...server,
      urls: Array.isArray(server.urls) ? [...server.urls] : server.urls,
    })),
    iceTransportPolicy: cached.iceTransportPolicy,
    expiresAt: cached.expiresAt,
  }
}

export const voiceIceCredentialsClient = new VoiceIceCredentialsClient()
