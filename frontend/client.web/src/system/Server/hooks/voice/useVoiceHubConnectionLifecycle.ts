import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import * as signalR from '@microsoft/signalr'
import { voiceCopy } from '../../../shared/index'
import { voiceDebug } from './voiceChannelDebug'
import {
  configureVoiceConnectionTimeout,
  createVoiceHubConnection,
} from './voiceHubConnection'
import {
  isVoiceAccessLeasePayloadForChannel,
  invokeGetVoiceChannelState,
  invokeJoinVoiceChannel,
  renewVoiceAccessLeaseWithTimeout,
  runVoiceAccessLeaseCheck,
} from './voiceHubCommands'
import type {
  ConnectedVoiceChannel,
  VoiceLifecycleState,
  VoiceParticipant,
  VoiceParticipantMovedPayload,
  VoiceSignalPayload,
  VoiceStatePayload,
} from './voiceChannelTypes'
import { normalizeUserId } from './voiceChannelUtils'

const voiceAccessLeaseIntervalMs = 8_000
const voiceAccessLeaseTimeoutMs = 4_000
const voiceAccessLeaseRetryMs = 2_000

type LocalVoiceState = {
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
}

type VoiceHubConnectionLifecycleOptions = {
  accessToken: string
  currentUserId: string
  connectionRef: RefObject<signalR.HubConnection | null>
  connectedChannelRef: RefObject<ConnectedVoiceChannel | null>
  localParticipantIdRef: RefObject<string | null>
  sanitizeVoiceParticipants: (
    spaceId: string,
    participants: VoiceParticipant[],
  ) => VoiceParticipant[]
  setParticipantsBySpaceId: Dispatch<
    SetStateAction<Record<string, VoiceParticipant[]>>
  >
  syncPeers: (spaceId: string, participants: VoiceParticipant[]) => Promise<void>
  recoverMissingRemoteVideo: (
    spaceId: string,
    participants: VoiceParticipant[],
  ) => void
  handleVoiceSignal: (payload: VoiceSignalPayload) => Promise<void>
  setVoiceError: Dispatch<SetStateAction<string | null>>
  beginVoiceOperation: (nextState: VoiceLifecycleState) => number
  disconnectLocalVoiceSession: (
    operationId?: number,
    nextState?: VoiceLifecycleState,
  ) => Promise<void>
  markSpaceStale: (spaceId: string) => void
  markSpaceFresh: (spaceId: string) => void
  removeCurrentUserFromSpace: (spaceId: string) => void
  closeAllPeers: () => void
  setConnectedChannel: Dispatch<SetStateAction<ConnectedVoiceChannel | null>>
  isCurrentVoiceOperation: (operationId: number) => boolean
  setVoiceLifecycle: (nextState: VoiceLifecycleState) => void
  getLocalVoiceState: () => LocalVoiceState
  enforceServerMediaCapabilities: (capabilities: {
    canSpeak: boolean
    canUseVideo: boolean
    canShareScreen: boolean
  }) => Promise<void>
  setLocalVoiceParticipantId: (participantId: string | null) => void
  invalidateVoiceOperations: () => void
  stopLocalStream: () => void
}

export function useVoiceHubConnectionLifecycle({
  accessToken,
  currentUserId,
  connectionRef,
  connectedChannelRef,
  localParticipantIdRef,
  sanitizeVoiceParticipants,
  setParticipantsBySpaceId,
  syncPeers,
  recoverMissingRemoteVideo,
  handleVoiceSignal,
  setVoiceError,
  beginVoiceOperation,
  disconnectLocalVoiceSession,
  markSpaceStale,
  markSpaceFresh,
  removeCurrentUserFromSpace,
  closeAllPeers,
  setConnectedChannel,
  isCurrentVoiceOperation,
  setVoiceLifecycle,
  getLocalVoiceState,
  enforceServerMediaCapabilities,
  setLocalVoiceParticipantId,
  invalidateVoiceOperations,
  stopLocalStream,
}: VoiceHubConnectionLifecycleOptions) {
  useEffect(() => {
    let isDisposed = false
    let leaseTimerId: number | null = null
    let isLeaseRenewalInFlight = false
    let rejoinTimerId: number | null = null

    function applyVoiceState(payload?: VoiceStatePayload) {
      if (!payload?.spaceId) {
        return
      }

      const participants = sanitizeVoiceParticipants(
        payload.spaceId,
        payload.participants ?? [],
      )
      const normalizedLocalParticipantId = normalizeUserId(
        localParticipantIdRef.current ?? '',
      )
      const normalizedCurrentUserId = normalizeUserId(currentUserId)
      const localParticipant = participants.find(
        (participant) =>
          normalizeUserId(participant.participantId) === normalizedLocalParticipantId ||
          normalizeUserId(participant.userId) === normalizedCurrentUserId,
      )
      if (payload.serverId && localParticipant) {
        void enforceServerMediaCapabilities({
          canSpeak: localParticipant.canSpeak !== false,
          canUseVideo: localParticipant.canUseVideo !== false,
          canShareScreen: localParticipant.canShareScreen !== false,
        }).catch((error) => {
          voiceDebug('local-media:permission-enforcement-failed', {
            message: error instanceof Error ? error.message : String(error),
          })
        })
      }
      voiceDebug('state:changed', {
        spaceId: payload.spaceId,
        participants: participants.map((participant) => ({
          participantId: normalizeUserId(participant.participantId),
          userId: normalizeUserId(participant.userId),
          login: participant.login,
          isMuted: participant.isMuted,
          isDeafened: participant.isDeafened,
          isCameraEnabled: participant.isCameraEnabled,
          isScreenSharing: participant.isScreenSharing,
          canSpeak: participant.canSpeak,
          canUseVideo: participant.canUseVideo,
          canShareScreen: participant.canShareScreen,
        })),
      })
      setParticipantsBySpaceId((current) => ({
        ...current,
        [payload.spaceId]: participants,
      }))
      window.setTimeout(() => {
        void syncPeers(payload.spaceId, participants).then(() => {
          recoverMissingRemoteVideo(payload.spaceId, participants)
        })
      }, 0)
    }

    function stopVoiceAccessLeaseHeartbeat() {
      if (leaseTimerId !== null) {
        window.clearTimeout(leaseTimerId)
        leaseTimerId = null
      }
    }

    function scheduleVoiceAccessLeaseHeartbeat(
      delayMs = voiceAccessLeaseIntervalMs,
    ) {
      if (isDisposed) {
        return
      }

      stopVoiceAccessLeaseHeartbeat()
      leaseTimerId = window.setTimeout(() => {
        leaseTimerId = null
        void renewVoiceAccessLease()
      }, delayMs)
    }

    async function renewVoiceAccessLease() {
      if (isDisposed || isLeaseRenewalInFlight) {
        scheduleVoiceAccessLeaseHeartbeat()
        return
      }

      const channel = connectedChannelRef.current
      const localParticipantId = localParticipantIdRef.current
      if (
        !channel ||
        !localParticipantId ||
        connection.state !== signalR.HubConnectionState.Connected
      ) {
        scheduleVoiceAccessLeaseHeartbeat()
        return
      }

      isLeaseRenewalInFlight = true
      let nextLeaseDelayMs = voiceAccessLeaseIntervalMs
      try {
        const result = await runVoiceAccessLeaseCheck({
          renew: () =>
            renewVoiceAccessLeaseWithTimeout(
              connection,
              channel,
              voiceAccessLeaseTimeoutMs,
            ),
          isCurrent: () => {
            const currentChannel = connectedChannelRef.current
            return Boolean(
              !isDisposed &&
                currentChannel &&
                localParticipantIdRef.current === localParticipantId &&
                normalizeUserId(currentChannel.spaceId) ===
                  normalizeUserId(channel.spaceId) &&
                currentChannel.channelScope === channel.channelScope,
            )
          },
          isAccepted: (payload) =>
            isVoiceAccessLeasePayloadForChannel(
              payload,
              channel,
              localParticipantId,
            ),
          onAccepted: applyVoiceState,
          onDenied: async () => {
            voiceDebug('channel:access-lease-denied', {
              serverId: channel.serverId,
              spaceId: channel.spaceId,
              channelScope: channel.channelScope,
            })
            const operationId = beginVoiceOperation('leaving')
            await disconnectLocalVoiceSession(operationId, 'idle')
          },
          onTransportError: (error) => {
            voiceDebug('channel:access-lease-unavailable', {
              serverId: channel.serverId,
              spaceId: channel.spaceId,
              channelScope: channel.channelScope,
              message: error instanceof Error ? error.message : String(error),
            })
          },
        })
        if (result === 'unavailable') {
          nextLeaseDelayMs = voiceAccessLeaseRetryMs
        }
      } finally {
        isLeaseRenewalInFlight = false
        scheduleVoiceAccessLeaseHeartbeat(nextLeaseDelayMs)
      }
    }
    function stopVoiceRejoinRetry() {
      if (rejoinTimerId !== null) {
        window.clearTimeout(rejoinTimerId)
        rejoinTimerId = null
      }
    }

    function scheduleVoiceRejoinRetry() {
      if (isDisposed || rejoinTimerId !== null) {
        return
      }

      rejoinTimerId = window.setTimeout(() => {
        rejoinTimerId = null
        if (
          !isDisposed &&
          connectedChannelRef.current &&
          connection.state === signalR.HubConnectionState.Connected
        ) {
          rejoinVoiceChannel()
        }
      }, voiceAccessLeaseRetryMs)
    }

    function rejoinVoiceChannel() {
      const channel = connectedChannelRef.current
      if (
        isDisposed ||
        !channel ||
        connection.state !== signalR.HubConnectionState.Connected
      ) {
        return
      }

      stopVoiceRejoinRetry()
      const operationId = beginVoiceOperation('reconnecting')
      closeAllPeers()
      setLocalVoiceParticipantId(null)
      const localVoiceState = getLocalVoiceState()
      let wasAccessDenied = false
      voiceDebug('signalr:reconnected', channel)
      configureVoiceConnectionTimeout(connection, channel.channelScope)
      void invokeJoinVoiceChannel(connection, channel, localVoiceState)
        .then((participantId?: string | null) => {
          if (!isCurrentVoiceOperation(operationId)) {
            return
          }

          if (!participantId) {
            wasAccessDenied = true
            throw new Error(voiceCopy.errors.joinFailed)
          }

          setLocalVoiceParticipantId(participantId)
          return invokeGetVoiceChannelState(connection, channel)
        })
        .then(() => {
          if (!isCurrentVoiceOperation(operationId)) {
            return
          }

          setVoiceError(null)
          setVoiceLifecycle('connected')
          scheduleVoiceAccessLeaseHeartbeat()
        })
        .catch(async (error) => {
          if (!isCurrentVoiceOperation(operationId)) {
            return
          }

          voiceDebug(
            wasAccessDenied
              ? 'signalr:rejoin-denied'
              : 'signalr:rejoin-unavailable',
            {
              message: error instanceof Error ? error.message : String(error),
            },
          )
          if (wasAccessDenied) {
            setVoiceError(voiceCopy.errors.joinFailed)
            await disconnectLocalVoiceSession(operationId, 'error')
            return
          }

          setVoiceError(voiceCopy.errors.reconnectFailed)
          setVoiceLifecycle('reconnecting')
          scheduleVoiceRejoinRetry()
        })
    }


    const connection = createVoiceHubConnection(accessToken, {
      onStateChanged: applyVoiceState,
      onSignal: (payload?: VoiceSignalPayload) => {
        if (!payload) {
          return
        }

        voiceDebug('signal:received', {
          kind: payload.kind,
          spaceId: payload.spaceId,
          fromUserId: normalizeUserId(payload.fromUserId),
          fromParticipantId: normalizeUserId(payload.fromParticipantId),
          payloadLength: payload.payload.length,
        })
        void handleVoiceSignal(payload).catch((error) => {
          voiceDebug('signal:error', {
            message: error instanceof Error ? error.message : String(error),
          })
          setVoiceError(
            error instanceof Error ? error.message : voiceCopy.errors.signalFailed,
          )
        })
      },
      onConnectionReplaced: () => {
        stopVoiceAccessLeaseHeartbeat()
        stopVoiceRejoinRetry()
        voiceDebug('channel:replaced')
        const operationId = beginVoiceOperation('leaving')
        void disconnectLocalVoiceSession(operationId, 'idle')
      },
      onAccessRevoked: (payload) => {
        const channel = connectedChannelRef.current
        const connectedServerId = channel?.serverId
        const revokedServerId = payload?.serverId
        if (
          !channel ||
          channel.channelScope !== 'server' ||
          !connectedServerId ||
          (revokedServerId &&
            normalizeUserId(revokedServerId) !== normalizeUserId(connectedServerId))
        ) {
          return
        }

        stopVoiceAccessLeaseHeartbeat()
        stopVoiceRejoinRetry()
        voiceDebug('channel:access-revoked', { serverId: revokedServerId })
        const operationId = beginVoiceOperation('leaving')
        void disconnectLocalVoiceSession(operationId, 'idle')
      },
      onParticipantMoved: (payload?: VoiceParticipantMovedPayload) => {
        if (!payload?.targetSpaceId || !payload.participantId) {
          return
        }

        const currentParticipantId = localParticipantIdRef.current
        if (
          !currentParticipantId ||
          normalizeUserId(payload.participantId) !== currentParticipantId
        ) {
          return
        }

        const previousChannel = connectedChannelRef.current
        const nextChannel: ConnectedVoiceChannel = {
          serverId: payload.serverId,
          spaceId: payload.targetSpaceId,
          title: payload.title,
          channelScope: 'server',
        }
        stopVoiceRejoinRetry()
        const operationId = beginVoiceOperation('switching')

        if (previousChannel?.spaceId) {
          markSpaceStale(previousChannel.spaceId)
          removeCurrentUserFromSpace(previousChannel.spaceId)
        }

        closeAllPeers()
        connectedChannelRef.current = nextChannel
        setConnectedChannel(nextChannel)
        setVoiceError(null)
        voiceDebug('channel:moved', nextChannel)

        const activeConnection = connectionRef.current
        if (activeConnection?.state === signalR.HubConnectionState.Connected) {
          configureVoiceConnectionTimeout(
            activeConnection,
            nextChannel.channelScope,
          )
          void invokeGetVoiceChannelState(activeConnection, nextChannel).finally(() => {
            if (isCurrentVoiceOperation(operationId)) {
              markSpaceFresh(nextChannel.spaceId)
              setVoiceLifecycle('connected')
            }
          })
        } else if (isCurrentVoiceOperation(operationId)) {
          setVoiceLifecycle('reconnecting')
        }
      },
      onReconnecting: () => {
        stopVoiceAccessLeaseHeartbeat()
        stopVoiceRejoinRetry()
        if (connectedChannelRef.current) {
          beginVoiceOperation('reconnecting')
        }
      },
      onReconnected: rejoinVoiceChannel,
      onClose: () => {
        stopVoiceAccessLeaseHeartbeat()
        stopVoiceRejoinRetry()
        if (!connectedChannelRef.current) {
          return
        }

        const operationId = beginVoiceOperation('leaving')
        void disconnectLocalVoiceSession(operationId, 'idle')
      },
    })

    connectionRef.current = connection

    const startConnection = connection
      .start()
      .then(() => {
        voiceDebug('signalr:connected')
        scheduleVoiceAccessLeaseHeartbeat()
      })
      .catch((error) => {
        voiceDebug('signalr:start-failed', {
          message: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      isDisposed = true
      stopVoiceAccessLeaseHeartbeat()
      stopVoiceRejoinRetry()
      invalidateVoiceOperations()
      connectedChannelRef.current = null
      connectionRef.current = null
      closeAllPeers()
      stopLocalStream()
      void startConnection.finally(() => {
        if (
          isDisposed &&
          connection.state !== signalR.HubConnectionState.Disconnected
        ) {
          void connection.stop()
        }
      })
    }
    // The connection must be recreated only when authentication identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, currentUserId])
}
