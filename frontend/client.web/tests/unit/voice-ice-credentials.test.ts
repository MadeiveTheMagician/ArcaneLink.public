import { expect, test } from '@playwright/test'
import { resolveVoicePeerConfiguration } from '../../src/system/Server/hooks/voice/voiceChannelConfig'
import {
  VoiceIceCredentialsClient,
  VoiceIceCredentialsError,
  parseVoiceIceCredentialsResponse,
} from '../../src/system/Server/hooks/voice/voiceIceCredentialsClient'

const accessToken = 'access-token'
const cacheScope = 'user-1'

test.describe('voice ICE credentials', () => {
  test('accepts a future relay-only TURN response', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z')
    const credentials = parseVoiceIceCredentialsResponse(
      createResponse(now + 60_000),
      now,
    )

    expect(credentials).toEqual({
      iceServers: [
        {
          urls: [
            'turn:turn.example.test:3478?transport=udp',
            'turns:turn.example.test:5349?transport=tcp',
          ],
          username: '1770000000:user-1',
          credential: 'temporary-credential',
          credentialType: 'password',
        },
      ],
      iceTransportPolicy: 'relay',
      expiresAt: now + 60_000,
    })
  })

  test('rejects STUN, direct transport policy, and expired credentials', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z')

    expect(() =>
      parseVoiceIceCredentialsResponse(
        {
          ...createResponse(now + 60_000),
          iceServers: [
            {
              ...createResponse(now + 60_000).iceServers[0],
              urls: ['stun:stun.example.test:3478'],
            },
          ],
        },
        now,
      ),
    ).toThrow(VoiceIceCredentialsError)

    expect(() =>
      parseVoiceIceCredentialsResponse(
        {
          ...createResponse(now + 60_000),
          iceTransportPolicy: 'all',
        },
        now,
      ),
    ).toThrow(VoiceIceCredentialsError)

    expect(() =>
      parseVoiceIceCredentialsResponse(createResponse(now + 5_000), now),
    ).toThrow(/expired/i)
  })

  test('caches in memory and refreshes before expiration', async () => {
    let now = 0
    let requestCount = 0
    const client = new VoiceIceCredentialsClient({
      now: () => now,
      fetchCredentials: async () => {
        requestCount += 1
        return createResponse(100_000 + requestCount)
      },
    })

    await client.get({ accessToken, cacheScope })
    now = 69_999
    await client.get({ accessToken, cacheScope })
    expect(requestCount).toBe(1)

    now = 70_001
    await client.get({ accessToken, cacheScope })
    expect(requestCount).toBe(2)
  })

  test('deduplicates concurrent refreshes for one authenticated user', async () => {
    let requestCount = 0
    let resolveRequest: ((value: unknown) => void) | null = null
    const responsePromise = new Promise<unknown>((resolve) => {
      resolveRequest = resolve
    })
    const client = new VoiceIceCredentialsClient({
      now: () => 0,
      fetchCredentials: async () => {
        requestCount += 1
        return responsePromise
      },
    })

    const first = client.get({ accessToken, cacheScope })
    const second = client.get({ accessToken, cacheScope })
    expect(requestCount).toBe(1)

    resolveRequest?.(createResponse(60_000))
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(requestCount).toBe(1)
  })

  test('uses still-valid cached credentials if an early refresh fails', async () => {
    let now = 0
    let requestCount = 0
    const client = new VoiceIceCredentialsClient({
      now: () => now,
      fetchCredentials: async () => {
        requestCount += 1
        if (requestCount > 1) {
          throw new Error('network unavailable')
        }
        return createResponse(100_000)
      },
    })

    const initial = await client.get({ accessToken, cacheScope })
    now = 70_001
    await expect(client.get({ accessToken, cacheScope })).resolves.toEqual(
      initial,
    )
    now = 75_000
    await expect(client.get({ accessToken, cacheScope })).resolves.toEqual(
      initial,
    )
    expect(requestCount).toBe(2)

    now = 96_000
    await expect(client.get({ accessToken, cacheScope })).rejects.toMatchObject({
      code: 'request_failed',
    })
  })

  test('isolates cache entries by authenticated user scope', async () => {
    let requestCount = 0
    const client = new VoiceIceCredentialsClient({
      now: () => 0,
      fetchCredentials: async () => {
        requestCount += 1
        return createResponse(60_000)
      },
    })

    await client.get({ accessToken, cacheScope: 'user-1' })
    await client.get({ accessToken, cacheScope: 'user-2' })
    expect(requestCount).toBe(2)
  })

  test('clears session credentials from memory', async () => {
    let requestCount = 0
    const client = new VoiceIceCredentialsClient({
      now: () => 0,
      fetchCredentials: async () => {
        requestCount += 1
        return createResponse(60_000)
      },
    })

    await client.get({ accessToken, cacheScope })
    client.clear()
    await client.get({ accessToken, cacheScope })

    expect(requestCount).toBe(2)
  })

  test('builds a relay-only RTC configuration from runtime credentials', async () => {
    const configuration = await resolveVoicePeerConfiguration({
      accessToken,
      cacheScope,
      allowDevelopmentFallback: false,
      isDevelopmentBuild: false,
      credentialsClient: {
        get: async () => ({
          iceServers: createResponse(60_000).iceServers,
          iceTransportPolicy: 'relay',
          expiresAt: 60_000,
        }),
      },
    })

    expect(configuration.iceTransportPolicy).toBe('relay')
    expect(configuration.iceServers).toHaveLength(1)
  })

  test('fails closed in production when credentials are unavailable', async () => {
    const request = resolveVoicePeerConfiguration({
      accessToken,
      cacheScope,
      allowDevelopmentFallback: true,
      isDevelopmentBuild: false,
      credentialsClient: {
        get: async () => {
          throw new VoiceIceCredentialsError(
            'request_failed',
            'unavailable',
          )
        },
      },
    })

    await expect(request).rejects.toBeInstanceOf(VoiceIceCredentialsError)
  })

  test('allows STUN only through the explicit local-development fallback', async () => {
    const configuration = await resolveVoicePeerConfiguration({
      accessToken,
      cacheScope,
      allowDevelopmentFallback: true,
      isDevelopmentBuild: true,
      credentialsClient: {
        get: async () => {
          throw new Error('backend is not configured locally')
        },
      },
    })

    expect(configuration).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      iceTransportPolicy: 'all',
    })
  })
})

function createResponse(expiresAt: number) {
  return {
    iceServers: [
      {
        urls: [
          'turn:turn.example.test:3478?transport=udp',
          'turns:turn.example.test:5349?transport=tcp',
        ],
        username: '1770000000:user-1',
        credential: 'temporary-credential',
        credentialType: 'password' as const,
      },
    ],
    iceTransportPolicy: 'relay' as const,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}
