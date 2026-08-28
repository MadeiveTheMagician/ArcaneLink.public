import { expect, test } from '@playwright/test'

test('only the latest routed voice cue plays at a fixed rate', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    let enumerateDeviceCalls = 0
    const playbackCalls: Array<{
      playbackRate: number
      src: string
      volume: number
    }> = []

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: async () => {
          enumerateDeviceCalls += 1
          await new Promise((resolve) => window.setTimeout(resolve, 50))
          return []
        },
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
      configurable: true,
      value: async () => undefined,
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value(this: HTMLMediaElement) {
        playbackCalls.push({
          playbackRate: this.playbackRate,
          src: this.src,
          volume: this.volume,
        })
        return Promise.resolve()
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: () => undefined,
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: () => undefined,
    })

    const [{ createVoiceConnectionCuePlayer }, { defaultVoiceSettings }] =
      await Promise.all([
        import('/src/system/shared/voice/voiceConnectionCue.ts'),
        import('/src/system/shared/voice/voiceSettings.ts'),
      ])
    const player = createVoiceConnectionCuePlayer()
    const settings = {
      ...defaultVoiceSettings,
      outputDeviceId: 'missing-output',
    }

    const stalePlayback = player.play('connected', settings)
    const latestPlayback = player.play('disconnected', settings)
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    const playbackCountBeforeRoutingCompletes = playbackCalls.length
    await Promise.all([stalePlayback, latestPlayback])

    const playbackCountBeforeCancellation = playbackCalls.length
    const canceledPlayback = player.play('connected', settings)
    player.stop()
    await canceledPlayback
    const playbackCountAfterCancellation = playbackCalls.length
    await player.dispose()

    return {
      enumerateDeviceCalls,
      playbackCalls,
      playbackCountAfterCancellation,
      playbackCountBeforeCancellation,
      playbackCountBeforeRoutingCompletes,
    }
  })

  expect(result.playbackCountBeforeRoutingCompletes).toBe(0)
  expect(result.enumerateDeviceCalls).toBe(2)
  expect(result.playbackCalls).toHaveLength(1)
  expect(result.playbackCalls[0]).toMatchObject({
    playbackRate: 1,
    volume: 0.68,
  })
  expect(result.playbackCalls[0]?.src).toContain('voice-disconnected')
  expect(result.playbackCountAfterCancellation).toBe(
    result.playbackCountBeforeCancellation,
  )
})
