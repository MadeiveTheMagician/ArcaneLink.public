import * as signalR from '@microsoft/signalr'
import { isVoiceDebugEnabled } from './voiceChannelDebug'
import { registerIgnoredRealtimeEvents } from './voiceRealtimeEvents'
import { createSafeVoiceSignalRLogger } from './voiceSignalRLogger'
import type {
  PrivateCallState,
  VoiceAccessRevokedPayload,
  VoiceChannelScope,
  VoiceConnectionReplacedPayload,
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
  onConnectionReplaced: (payload?: VoiceConnectionReplacedPayload) => void
  onAccessRevoked: (payload?: VoiceAccessRevokedPayload) => void
  onParticipantMoved: (payload?: VoiceParticipantMovedPayload) => void
  onIncomingPrivateCall: (payload?: PrivateCallState) => void
  onPrivateCallStateChanged: (payload?: PrivateCallState) => void
  onUserProfileChanged: () => void
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
    .configureLogging(createSafeVoiceSignalRLogger(isVoiceDebugEnabled))
    .build()

  registerIgnoredRealtimeEvents(connection)
  connection.on('VoiceChannelStateChanged', handlers.onStateChanged)
  connection.on('VoiceSignal', handlers.onSignal)
  connection.on('VoiceConnectionReplaced', handlers.onConnectionReplaced)
  connection.on('VoiceAccessRevoked', handlers.onAccessRevoked)
  connection.on('VoiceParticipantMoved', handlers.onParticipantMoved)
  connection.on('IncomingPrivateCall', handlers.onIncomingPrivateCall)
  connection.on('PrivateCallStateChanged', handlers.onPrivateCallStateChanged)
  connection.on('UserProfileChanged', handlers.onUserProfileChanged)
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
