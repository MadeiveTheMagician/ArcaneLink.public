import { expect, test } from '@playwright/test'
import { LogLevel } from '@microsoft/signalr'
import {
  createSafeVoiceSignalRLogger,
  redactVoiceSignalRLogMessage,
} from '../../src/system/Server/hooks/voice/voiceSignalRLogger'

test.describe('safe voice SignalR logger', () => {
  test('redacts access tokens, bearer credentials and standalone JWTs', () => {
    const token = 'eyJheader12345.payload.signature'
    const messages = [
     `Connected to wss://example.test/hub?id=1&access_token=${token}`,
      `access_token=${token}`,
     `payload={"access_token":"${token}"}`,
      `Authorization: Bearer ${token}`,
      `encoded=access_token%3D${token}`,
      `token ${token}`,
    ]

    for (const message of messages) {
      const redacted = redactVoiceSignalRLogMessage(message)
      expect(redacted).toContain('[REDACTED]')
      expect(redacted).not.toContain(token)
    }
  })

  test('writes only information-and-higher messages when enabled', () => {
    const messages: string[] = []
    const logger = createSafeVoiceSignalRLogger(true, (message) => {
      messages.push(message)
    })

    logger.log(LogLevel.Debug, 'debug message')
    logger.log(
      LogLevel.Information,
      'Connected?access_token=private-token',
    )
    logger.log(LogLevel.Warning, 'recovering')

    expect(messages).toEqual([
      '[voice-signalr] Connected?access_token=[REDACTED]',
      '[voice-signalr] recovering',
    ])
  })

  test('does not write framework logs when voice debug is disabled', () => {
    const messages: string[] = []
    const logger = createSafeVoiceSignalRLogger(false, (message) => {
      messages.push(message)
    })

    logger.log(LogLevel.Critical, 'access_token=private-token')

    expect(messages).toEqual([])
  })
})
