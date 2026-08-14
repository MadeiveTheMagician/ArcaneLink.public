import { useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { voiceDebug } from './voiceChannelDebug'
import { resolveVoicePeerConfiguration } from './voiceChannelConfig'
import {
  VoiceIceCredentialsError,
  voiceIceCredentialsClient,
} from './voiceIceCredentialsClient'
import { configureVoiceConnectionTimeout } from './voiceHubConnection'
import { useLocalVoiceMedia } from './useLocalVoiceMedia'
import { usePendingVoiceIceCandidates } from './usePendingVoiceIceCandidates'
import { useRemoteVoiceStreams } from './useRemoteVoiceStreams'
import { useVoiceActivityMonitor } from './useVoiceActivityMonitor'
import { useVoiceHubConnectionLifecycle } from './useVoiceHubConnectionLifecycle'
import { useVoiceIceCandidates } from './useVoiceIceCandidates'
import { useVoiceLifecycle } from './useVoiceLifecycle'
import { useVoicePeerConnections } from './useVoicePeerConnections'
import { useVoiceConnectionDiagnostics } from './useVoiceConnectionDiagnostics'
import { useVoicePeerOrchestrator } from './useVoicePeerOrchestrator'
import { useVoicePeerStatuses } from './useVoicePeerStatuses'
import { useVoiceParticipantMembership } from './useVoiceParticipantMembership'
import { useVoiceSignalingController } from './useVoiceSignalingController'
import { useVoiceVideoSenders } from './useVoiceVideoSenders'
import {
  invokeDisconnectVoiceParticipant,
  invokeGetVoiceChannelState,
  invokeJoinVoiceChannel,
  invokeUpdateVoiceParticipantModeration,
  waitForConnected,
} from './voiceHubCommands'
import { scheduleMissingRemoteVideoRecovery } from './voiceRemoteVideoRecovery'
import type {
  ConnectedVoiceChannel,
  VoiceLifecycleState,
  VoiceParticipant,
} from './voiceChannelTypes'
import { normalizeUserId } from './voiceChannelUtils'
import { voiceCopy } from '../../../shared/index'
import { useVoiceSettings } from '../../../shared/voice/useVoiceSettings'
export type {
  ConnectedVoiceChannel,
  VoiceConnectionDiagnostics,
  VoiceLifecycleState,
  VoiceParticipant,
  VoicePeerConnectionDiagnostics,
  VoicePeerStatus,
} from './voiceChannelTypes'
export type { VoiceNoiseSuppressionTelemetry } from './voiceNoiseSuppressionModel'

export function useVoiceChannel(
  accessToken: string,
  currentUserId: string,
) {
  const normalizedCurrentUserId = normalizeUserId(currentUserId)
  const getPeerConfiguration = () =>
    resolveVoicePeerConfiguration({
      accessToken,
      cacheScope: normalizedCurrentUserId,
    })
  useEffect(
    () => () => voiceIceCredentialsClient.clear(),
    [normalizedCurrentUserId],
  )
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const connectedChannelRef = useRef<ConnectedVoiceChannel | null>(null)
  const localParticipantIdRef = useRef<string | null>(null)
  const remoteVideoRecoveryLastAttemptRef = useRef<Record<string, number>>({})
  const [connectedChannel, setConnectedChannel] =
    useState<ConnectedVoiceChannel | null>(null)
  const [connectionTargetChannel, setConnectionTargetChannel] =
    useState<ConnectedVoiceChannel | null>(null)
  const { settings: voiceSettings } = useVoiceSettings()
  const {
    peerStatusesByParticipantId,
    setPeerStatus,
    removePeerStatus,
  } = useVoicePeerStatuses()
  const {
    remoteStreamsByParticipantId,
    getRemoteStream,
    hasRemoteStream,
    setRemoteStream,
    removeRemoteStream,
    clearRemoteStreams,
  } = useRemoteVoiceStreams()
  const {
    speakingParticipantIds,
    resumeVoiceActivityAudioContext,
    startVoiceActivityMonitor,
    stopVoiceActivityMonitor,
    clearSpeakingParticipants,
  } = useVoiceActivityMonitor()
  const {
    voiceLifecycleState,
    isVoiceConnecting,
    beginVoiceOperation,
    invalidateVoiceOperations,
    isCurrentVoiceOperation,
    setVoiceLifecycle,
    getCurrentVoiceOperationId,
  } = useVoiceLifecycle()
  const {
    rememberCandidateType,
    getCandidateTypes,
    forgetCandidateTypes,
  } = useVoiceIceCandidates()
  const {
    queuePendingIceCandidate,
    getPendingIceCandidates,
    forgetPendingIceCandidates,
  } = usePendingVoiceIceCandidates()
  const {
    setVideoSender,
    getVideoSender,
    removeVideoSender,
  } = useVoiceVideoSenders()
  const {
    getPeerConnection,
    hasPeerConnection,
    setPeerConnection,
    getPeerConnectionIds,
    getPeerConnectionsSnapshot,
    isCurrentPeerConnection,
    closePeerConnection,
  } = useVoicePeerConnections()
  const connectionDiagnostics = useVoiceConnectionDiagnostics({
    connectedChannel,
    connectionTargetChannel,
    lifecycleState: voiceLifecycleState,
    voiceSettings,
    getPeerConnection,
    getPeerConnectionsSnapshot,
  })
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const {
    localCameraPreviewStream,
    localScreenPreviewStream,
    hasLocalAudioTrack,
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
    noiseSuppressionTelemetry,
    getLocalActivityStream,
    startLocalVoiceActivityMonitor,
    syncAudioTrackForPeer,
    getLocalVoiceState,
    enforceServerMediaCapabilities,
    ensureLocalStream,
    stopLocalStream,
    toggleMuted,
    toggleDeafened,
    enableCamera,
    disableCamera,
    toggleCamera,
    enableScreenShare,
    disableScreenShare,
    toggleScreenShare,
    replaceVideoTrackForPeer,
  } = useLocalVoiceMedia({
    currentUserId: normalizedCurrentUserId,
    getLocalParticipantId: () => localParticipantIdRef.current,
    getPeerConnectionIds,
    getPeerConnection,
    getVideoSender,
    renegotiatePeer: (participantId) => renegotiatePeer(participantId),
    recoverPeerConnection: (participantId) => recoverPeer(participantId),
    onVoiceStateChange: ({
      isMuted,
      isDeafened,
      isCameraEnabled,
      isScreenSharing,
    }) => {
      const channel = connectedChannelRef.current
      const connection = connectionRef.current
      if (channel && connection?.state === signalR.HubConnectionState.Connected) {
        void connection.invoke(
          'UpdateVoiceState',
          channel.spaceId,
          isMuted,
          isDeafened,
          isCameraEnabled,
          isScreenSharing,
        )
      }
    },
    startVoiceActivityMonitor,
    resumeVoiceActivityAudioContext,
    stopVoiceActivityMonitor,
    clearRemoteStreams,
    clearSpeakingParticipants,
  })
  const {
    localParticipantId,
    participantsBySpaceId,
    setParticipantsBySpaceId,
    isCurrentVoiceParticipant,
    setLocalVoiceParticipantId,
    markSpaceStale,
    markSpaceFresh,
    removeCurrentUserFromSpace,
    sanitizeVoiceParticipants,
  } = useVoiceParticipantMembership({
    currentUserId: normalizedCurrentUserId,
    localParticipantIdRef,
    getConnectedChannel: () => connectedChannelRef.current,
    getLocalActivityStream,
    startVoiceActivityMonitor: startLocalVoiceActivityMonitor,
    stopVoiceActivityMonitor,
  })
  const {
    syncPeers,
    ensurePeerConnection,
    renegotiatePeer,
    recoverPeer,
    closePeerIfCurrent,
    closeAllPeers,
    updatePeerStatus,
  } = useVoicePeerOrchestrator({
    getChannel: () => connectedChannelRef.current,
    getLocalParticipantId: () => localParticipantIdRef.current,
    getCurrentVoiceOperationId,
    isCurrentVoiceOperation,
    ensureLocalStream,
    getPeerConfiguration,
    syncAudioTrackForPeer,
    replaceVideoTrackForPeer,
    sendVoiceSignal: (targetParticipantId, kind, payload) =>
      sendVoiceSignal(targetParticipantId, kind, payload),
    getRemoteStream,
    setRemoteStream,
    removeRemoteStream,
    hasRemoteStream,
    startVoiceActivityMonitor,
    stopVoiceActivityMonitor,
    rememberCandidateType,
    getCandidateTypes,
    forgetCandidateTypes,
    forgetPendingIceCandidates,
    setVideoSender,
    getPeerConnection,
    hasPeerConnection,
    setPeerConnection,
    getPeerConnectionIds,
    isCurrentPeerConnection,
    closePeerConnection,
    removeVideoSender,
    setPeerStatus,
    removePeerStatus,
    setVoiceError,
  })
  const {
    handleVoiceSignal,
    sendVoiceSignal,
  } = useVoiceSignalingController({
    getChannel: () => connectedChannelRef.current,
    getConnection: () => connectionRef.current,
    getLocalParticipantId: () => localParticipantIdRef.current,
    getCurrentVoiceOperationId,
    isCurrentVoiceOperation,
    ensurePeerConnection,
    closePeerIfCurrent,
    getPeerConnection,
    getPendingIceCandidates,
    queuePendingIceCandidate,
    forgetPendingIceCandidates,
    rememberCandidateType,
    updatePeerStatus,
    setVoiceError,
  })

  function recoverMissingRemoteVideo(
    spaceId: string,
    participants: VoiceParticipant[],
  ) {
    scheduleMissingRemoteVideoRecovery({
      spaceId,
      participants,
      operationId: getCurrentVoiceOperationId(),
      lastAttemptByParticipant: remoteVideoRecoveryLastAttemptRef.current,
      getChannel: () => connectedChannelRef.current,
      isCurrentOperation: isCurrentVoiceOperation,
      isCurrentParticipant: isCurrentVoiceParticipant,
      getRemoteStream,
      hasPeerConnection,
      renegotiatePeer,
      debug: voiceDebug,
    })
  }

  async function disconnectLocalVoiceSession(
    operationId = getCurrentVoiceOperationId(),
    nextState: VoiceLifecycleState = 'idle',
  ) {
    if (!isCurrentVoiceOperation(operationId)) {
      return
    }

    const channel = connectedChannelRef.current
    if (channel) {
      markSpaceStale(channel.spaceId)
      removeCurrentUserFromSpace(channel.spaceId)
    }
    connectedChannelRef.current = null
    setConnectionTargetChannel(null)
    setLocalVoiceParticipantId(null)
    setConnectedChannel(null)
    remoteVideoRecoveryLastAttemptRef.current = {}
    closeAllPeers()
    await disableCamera()
    await disableScreenShare()
    stopLocalStream()
    setVoiceLifecycle(nextState)
  }

  useVoiceHubConnectionLifecycle({
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
  })

  async function ensureConnection() {
    const connection = connectionRef.current
    if (!connection) {
      return null
    }

    if (connection.state === signalR.HubConnectionState.Connected) {
      return connection
    }

    if (connection.state === signalR.HubConnectionState.Disconnected) {
      await connection.start()
    }

    if (
      connection.state === signalR.HubConnectionState.Connecting ||
      connection.state === signalR.HubConnectionState.Reconnecting
    ) {
      await waitForConnected(connection)
    }

    const state = connection.state as signalR.HubConnectionState

    return state === signalR.HubConnectionState.Connected
      ? connection
      : null
  }

  async function refreshServerVoiceStates(serverId: string, spaceIds: string[]) {
    const uniqueSpaceIds = Array.from(new Set(spaceIds.filter(Boolean)))
    if (uniqueSpaceIds.length === 0) {
      return
    }

    let connection: signalR.HubConnection | null
    try {
      connection = await ensureConnection()
    } catch (error) {
      voiceDebug('state:refresh-connection-failed', {
        serverId,
        message: error instanceof Error ? error.message : String(error),
      })
      return
    }

    if (!connection) {
      return
    }

    await Promise.all(
      uniqueSpaceIds.map((spaceId) =>
        invokeGetVoiceChannelState(connection, {
          serverId,
          spaceId,
          title: '',
          channelScope: 'server',
        }).catch((error) => {
          voiceDebug('state:refresh-failed', {
            serverId,
            spaceId,
            message: error instanceof Error ? error.message : String(error),
          })
        }),
      ),
    )
  }

  async function joinVoiceChannel(channel: ConnectedVoiceChannel) {
    const previousChannel = connectedChannelRef.current
    setConnectionTargetChannel(channel)
    const operationId = beginVoiceOperation(
      previousChannel && previousChannel.spaceId !== channel.spaceId
        ? 'switching'
        : 'joining',
    )
    setVoiceError(null)

    try {
      await getPeerConfiguration()
      if (!isCurrentVoiceOperation(operationId)) {
        return
      }

      const connection = await ensureConnection()
      if (!connection || !isCurrentVoiceOperation(operationId)) {
        if (isCurrentVoiceOperation(operationId)) {
          setConnectionTargetChannel(null)
          setVoiceLifecycle(
            connectedChannelRef.current ? 'connected' : 'idle',
          )
        }
        return
      }

      await ensureLocalStream()
      if (!isCurrentVoiceOperation(operationId)) {
        if (!connectedChannelRef.current) {
          stopLocalStream()
        }
        return
      }

      if (previousChannel && previousChannel.spaceId !== channel.spaceId) {
        markSpaceStale(previousChannel.spaceId)
        removeCurrentUserFromSpace(previousChannel.spaceId)
        closeAllPeers()
      }
      connectedChannelRef.current = channel
      setConnectedChannel(channel)
      voiceDebug('channel:join', channel)
      configureVoiceConnectionTimeout(connection, channel.channelScope)
      const localVoiceState = getLocalVoiceState()
      const participantId = await invokeJoinVoiceChannel(
        connection,
        channel,
        localVoiceState,
      )
      if (!isCurrentVoiceOperation(operationId)) {
        return
      }

      if (!participantId) {
        await disconnectLocalVoiceSession(operationId, 'error')
        setVoiceError(voiceCopy.errors.joinFailed)
        return
      }

      setLocalVoiceParticipantId(participantId)
      await invokeGetVoiceChannelState(connection, channel)
      if (isCurrentVoiceOperation(operationId)) {
        markSpaceFresh(channel.spaceId)
        setVoiceLifecycle('connected')
        setConnectionTargetChannel(null)
      }
    } catch (error) {
      if (!isCurrentVoiceOperation(operationId)) {
        return
      }

      await disconnectLocalVoiceSession(operationId, 'error')
      setVoiceError(
        error instanceof VoiceIceCredentialsError
          ? voiceCopy.errors.turnCredentialsUnavailable
          : error instanceof Error
          ? error.message
          : voiceCopy.errors.microphoneConnectFailed,
      )
    }
  }

  async function leaveVoiceChannel() {
    const operationId = beginVoiceOperation('leaving')
    setConnectionTargetChannel(null)
    const channel = connectedChannelRef.current
    const connection = connectionRef.current

    if (channel) {
      markSpaceStale(channel.spaceId)
      removeCurrentUserFromSpace(channel.spaceId)
    }

    try {
      if (channel && connection?.state === signalR.HubConnectionState.Connected) {
        voiceDebug('channel:leave', channel)
        await connection.invoke('LeaveVoiceChannel', channel.spaceId)
      }
    } finally {
      await disconnectLocalVoiceSession(operationId, 'idle')
    }
  }

  async function moveVoiceParticipant(
    serverId: string,
    sourceSpaceId: string,
    targetSpaceId: string,
    participantId: string,
  ) {
    if (sourceSpaceId === targetSpaceId) {
      return
    }

    const connection = await ensureConnection()
    if (!connection) {
      return
    }

    await connection.invoke(
      'MoveVoiceParticipant',
      serverId,
      sourceSpaceId,
      targetSpaceId,
      participantId,
    )
  }

  async function updateVoiceParticipantModeration({
    serverId,
    spaceId,
    participantId,
    isServerMuted,
    isServerDeafened,
  }: {
    serverId: string
    spaceId: string
    participantId: string
    isServerMuted?: boolean
    isServerDeafened?: boolean
  }) {
    const connection = await ensureConnection()
    if (!connection) {
      return false
    }

    return invokeUpdateVoiceParticipantModeration(connection, {
      serverId,
      spaceId,
      participantId,
      isServerMuted,
      isServerDeafened,
    })
  }

  async function disconnectVoiceParticipant({
    serverId,
    spaceId,
    participantId,
  }: {
    serverId: string
    spaceId: string
    participantId: string
  }) {
    const connection = await ensureConnection()
    if (!connection) {
      return false
    }

    return invokeDisconnectVoiceParticipant(connection, {
      serverId,
      spaceId,
      participantId,
    })
  }

  return {
    connectedChannel,
    connectionTargetChannel,
    connectionDiagnostics,
    localParticipantId,
    participantsBySpaceId,
    localCameraPreviewStream,
    localScreenPreviewStream,
    remoteStreamsByParticipantId,
    peerStatusesByParticipantId,
    speakingParticipantIds,
    voiceLifecycleState,
    isVoiceConnecting,
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
    noiseSuppressionTelemetry,
    hasLocalAudioTrack,
    voiceError,
    refreshServerVoiceStates,
    joinVoiceChannel,
    leaveVoiceChannel,
    moveVoiceParticipant,
    updateVoiceParticipantModeration,
    disconnectVoiceParticipant,
    toggleMuted,
    toggleDeafened,
    enableCamera,
    disableCamera,
    toggleCamera,
    enableScreenShare,
    disableScreenShare,
    toggleScreenShare,
  }
}

export type VoiceChannelController = ReturnType<typeof useVoiceChannel>
