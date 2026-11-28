import { expect, test, type WebSocketRoute } from '@playwright/test'

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
})

const recordSeparator = '\x1e'

test('voice stays active after token refresh and reconnects with the refreshed token', async ({ page }) => {
  const negotiatedTokens: (string | null)[] = []
  const sockets: WebSocketRoute[] = []
  const closedSockets: number[] = []
  const invocations: { socket: number; target: string }[] = []

  await page.route('**/voice-auth-refresh-harness', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<div id="root"></div><script type="module" src="/e2e/fixtures/voice-auth-refresh.harness.tsx"></script>',
  }))
  await page.route('**/hubs/realtime/negotiate?*', (route) => {
    negotiatedTokens.push(route.request().headers().authorization ?? null)
    const id = `connection-${negotiatedTokens.length}`
    return route.fulfill({
      json: {
        negotiateVersion: 1,
        connectionId: id,
        connectionToken: id,
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }],
      },
    })
  })
  await page.route('**/api/voice/ice-servers', (route) => route.fulfill({
    json: {
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      iceTransportPolicy: 'relay',
      iceServers: [{
        urls: ['turn:127.0.0.1:3478'],
        username: 'test-user',
        credential: 'test-credential',
        credentialType: 'password',
      }],
    },
  }))
  await page.routeWebSocket(/\/hubs\/realtime\?/, (socket) => {
    const index = sockets.push(socket) - 1
    socket.onClose(() => closedSockets.push(index))
    socket.onMessage((data) => {
      const messages = data.toString().split(recordSeparator).filter(Boolean)
      for (const message of messages) {
        const invocation = JSON.parse(message) as {
          protocol?: string
          target?: string
          invocationId?: string
        }
        if (invocation.protocol) {
          socket.send(`{}${recordSeparator}`)
        } else if (invocation.target && invocation.invocationId !== undefined) {
          invocations.push({ socket: index, target: invocation.target })
          const result = invocation.target === 'JoinVoiceChannel'
            ? `participant-${index}`
            : invocation.target === 'GetIncomingPrivateCalls' ? [] : null
          socket.send(JSON.stringify({ type: 3, invocationId: invocation.invocationId, result }) + recordSeparator)
        }
      }
    })
  })

  await page.goto('/voice-auth-refresh-harness')
  await page.getByRole('button', { name: 'Join voice' }).click()
  await expect(page.getByTestId('voice-state')).toHaveText('connected')
  await expect(page.getByTestId('microphone')).toHaveText('live')
  expect(negotiatedTokens).toEqual(['Bearer initial-token'])

  await page.getByRole('button', { name: 'Rotate access token' }).click()
  await page.getByRole('button', { name: 'Toggle microphone' }).click()
  await expect.poll(() => invocations).toContainEqual({ socket: 0, target: 'UpdateVoiceState' })
  await expect(page.getByTestId('voice-state')).toHaveText('connected')
  await expect(page.getByTestId('microphone')).toHaveText('live')
  expect(negotiatedTokens).toEqual(['Bearer initial-token'])
  expect(closedSockets).toEqual([])

  await sockets[0].close({ code: 1011, reason: 'Test disconnect' })
  await expect.poll(() => negotiatedTokens).toEqual(['Bearer initial-token', 'Bearer refreshed-token'])
  await expect.poll(() => invocations).toContainEqual({ socket: 1, target: 'JoinVoiceChannel' })
  await expect(page.getByTestId('voice-state')).toHaveText('connected')

  await page.getByRole('button', { name: 'Change device session' }).click()
  await expect.poll(() => negotiatedTokens).toEqual([
    'Bearer initial-token', 'Bearer refreshed-token', 'Bearer replacement-token',
  ])
  await expect(page.getByTestId('microphone')).toHaveText('stopped')
})
