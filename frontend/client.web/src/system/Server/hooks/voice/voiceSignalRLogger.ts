import { LogLevel, type ILogger } from '@microsoft/signalr'

type VoiceSignalRLogWriter = (message: string) => void

const queryAccessTokenPattern = /(\baccess_token=)[^&#\s"']+/gi
const encodedAccessTokenPattern = /(access_token%3d)[^&\s"']+/gi
const jsonAccessTokenPattern = /(["']access_token["']\s*:\s*["'])[^"']+/gi
const bearerTokenPattern = /(bearer\s+)[a-z0-9._~+/-]+=*/gi
const jwtPattern = /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi

export function redactVoiceSignalRLogMessage(message: string) {
  return message
    .replace(queryAccessTokenPattern, '$1[REDACTED]')
    .replace(encodedAccessTokenPattern, '$1[REDACTED]')
    .replace(jsonAccessTokenPattern, '$1[REDACTED]')
    .replace(bearerTokenPattern, '$1[REDACTED]')
    .replace(jwtPattern, '[REDACTED]')
}

export function createSafeVoiceSignalRLogger(
  isEnabled: boolean,
  write: VoiceSignalRLogWriter = (message) => console.info(message),
): ILogger {
  return {
    log(logLevel, message) {
      if (
        !isEnabled ||
        logLevel < LogLevel.Information ||
        logLevel >= LogLevel.None
      ) {
        return
      }

      write(
        `[voice-signalr] ${redactVoiceSignalRLogMessage(String(message))}`,
      )
    },
  }
}
