import * as signalR from '@microsoft/signalr'
import { isVoiceDebugEnabled } from './voiceChannelDebug'
import { registerIgnoredRealtimeEvents } from './voiceRealtimeEvents'
import type {
  VoiceChannelScope,
  VoiceParticipantMovedPayload,
  VoiceSignalPayload,
  VoiceStatePayload,
} from './voiceChannelTypes'

const serverVoiceServerTimeoutMs = 45_000
const privateVoiceServerTimeoutMs = 45_000
const voiceReconnectDelaysMs = [0, 2_000, 10_000, 30_000] as const

export function resolveVoiceReconnectDelayMs(previousRetryCount: number) {
  const retryIndex = Math.max(
    0,
    Math.min(previousRetryCount, voiceReconnectDelaysMs.length - 1),
  )
  return voiceReconnectDelaysMs[retryIndex]
}

type VoiceHubConnectionHandlers = {
  onStateChanged: (payload?: VoiceStatePayload) => void
  onSignal: (payload?: VoiceSignalPayload) => void
  onConnectionReplaced: () => void
  onAccessRevoked: (payload?: { serverId?: string | null }) => void
  onParticipantMoved: (payload?: VoiceParticipantMovedPayload) => void
  onReconnecting: () => void
  onReconnected: () => void
  onClose: () => void
}

export function createVoiceHubConnection(
  accessToken: string,
  handlers: VoiceHubConnectionHandlers,
) {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/realtime', {
      accessTokenFactory: () => accessToken,
    })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
        resolveVoiceReconnectDelayMs(previousRetryCount),
    })
    .configureLogging(
      isVoiceDebugEnabled ? signalR.LogLevel.Information : signalR.LogLevel.None,
    )
    .build()

  registerIgnoredRealtimeEvents(connection)
  connection.on('VoiceChannelStateChanged', handlers.onStateChanged)
  connection.on('VoiceSignal', handlers.onSignal)
  connection.on('VoiceConnectionReplaced', handlers.onConnectionReplaced)
  connection.on('VoiceAccessRevoked', handlers.onAccessRevoked)
  connection.on('VoiceParticipantMoved', handlers.onParticipantMoved)
  connection.onreconnecting(handlers.onReconnecting)
  connection.onreconnected(handlers.onReconnected)
  connection.onclose(handlers.onClose)

  return connection
}

export function configureVoiceConnectionTimeout(
  connection: signalR.HubConnection,
  channelScope: VoiceChannelScope,
) {
  connection.serverTimeoutInMilliseconds =
    channelScope === 'server'
      ? serverVoiceServerTimeoutMs
      : privateVoiceServerTimeoutMs
}
