import { useEffect, useRef, useState } from 'react';

import * as signalR from '@microsoft/signalr';

import { voiceCopy } from '../../../shared/index';
import { useVoiceSettings } from '../../../shared/voice/useVoiceSettings';
import { createVoiceConnectionCuePlayer } from '../../../shared/voice/voiceConnectionCue';
import { requestVoicePlaybackUnlock } from '../../../shared/voice/voicePlaybackUnlock';
import { shouldDisconnectForPrivateCallState } from './privateCallModel';
import { useLocalVoiceMedia } from './useLocalVoiceMedia';
import { usePendingVoiceIceCandidates } from './usePendingVoiceIceCandidates';
import { usePrivateCallLifecycle } from './usePrivateCallLifecycle';
import { useRemoteVoiceStreams } from './useRemoteVoiceStreams';
import { useVoiceActivityMonitor } from './useVoiceActivityMonitor';
import { useVoiceConnectionDiagnostics } from './useVoiceConnectionDiagnostics';
import { useVoiceHubConnectionLifecycle } from './useVoiceHubConnectionLifecycle';
import { useVoiceIceCandidates } from './useVoiceIceCandidates';
import { useVoiceLifecycle } from './useVoiceLifecycle';
import { useVoiceParticipantMembership } from './useVoiceParticipantMembership';
import { useVoicePeerConnections } from './useVoicePeerConnections';
import { useVoicePeerOrchestrator } from './useVoicePeerOrchestrator';
import { useVoicePeerStatuses } from './useVoicePeerStatuses';
import { useVoiceSignalingController } from './useVoiceSignalingController';
import { useVoiceVideoSenders } from './useVoiceVideoSenders';
import { resolveVoicePeerConfiguration } from './voiceChannelConfig';
import { voiceDebug } from './voiceChannelDebug';
import type {
  ConnectedVoiceChannel,
  PrivateCallJoinResult,
  PrivateCallState,
  VoiceAccessRevokedPayload,
  VoiceConnectionReplacedPayload,
  VoiceLifecycleState,
  VoiceParticipant
} from './voiceChannelTypes';
import { normalizeUserId } from './voiceChannelUtils';
import {
  resolvePendingVoiceAccessRevocations,
  resolvePendingVoiceConnectionReplacements
} from './voiceConnectionReplacementModel';
import {
  invokeAcceptPrivateCall,
  invokeCancelPrivateCall,
  invokeDeclinePrivateCall,
  invokeDisconnectVoiceParticipant,
  invokeGetPrivateCallState,
  invokeGetVoiceChannelState,
  invokeJoinVoiceChannel,
  invokeStartPrivateCall,
  invokeUpdateVoiceParticipantModeration,
  leavePreviousVoiceChannelAfterFailedSwitch,
  leaveStaleVoiceJoin,
  prepareVoiceJoinMedia,
  waitForConnected
} from './voiceHubCommands';
import { configureVoiceConnectionTimeout } from './voiceHubConnection';
import {
  VoiceIceCredentialsError,
  voiceIceCredentialsClient
} from './voiceIceCredentialsClient';
import { scheduleMissingRemoteVideoRecovery } from './voiceRemoteVideoRecovery';
import {
  createVoiceStateUpdateSynchronizer,
  enqueueAcceptedVoiceGenerationState
} from './voiceStateUpdateSynchronizer';

export type {
  ConnectedVoiceChannel,
  VoiceConnectionDiagnostics,
  VoiceLifecycleState,
  VoiceParticipant,
  VoicePeerConnectionDiagnostics,
  VoicePeerStatus
} from './voiceChannelTypes';
export type { VoiceNoiseSuppressionTelemetry } from './voiceNoiseSuppressionModel';

export function useVoiceChannel(accessToken: string, currentUserId: string) {
  const normalizedCurrentUserId = normalizeUserId(currentUserId);
  const getPeerConfiguration = () =>
    resolveVoicePeerConfiguration({
      accessToken,
      cacheScope: normalizedCurrentUserId
    });
  useEffect(
    () => () => voiceIceCredentialsClient.clear(),
    [normalizedCurrentUserId]
  );
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const connectedChannelRef = useRef<ConnectedVoiceChannel | null>(null);
  const connectionCuePlayerRef = useRef<ReturnType<
    typeof createVoiceConnectionCuePlayer
  > | null>(null);
  const privateCallConnectedCueIdsRef = useRef(new Set<string>());
  const localParticipantIdRef = useRef<string | null>(null);
  const localPrivateCallIdRef = useRef<string | null>(null);
  const pendingConnectionReplacementsRef = useRef<
    VoiceConnectionReplacedPayload[]
  >([]);
  const pendingVoiceAccessRevocationsRef = useRef<VoiceAccessRevokedPayload[]>(
    []
  );
  const voiceStateUpdateSynchronizerRef = useRef<ReturnType<
    typeof createVoiceStateUpdateSynchronizer
  > | null>(null);
  const remoteVideoRecoveryLastAttemptRef = useRef<Record<string, number>>({});
  const [connectedChannel, setConnectedChannel] =
    useState<ConnectedVoiceChannel | null>(null);
  const [connectionTargetChannel, setConnectionTargetChannel] =
    useState<ConnectedVoiceChannel | null>(null);
  const { settings: voiceSettings } = useVoiceSettings();
  const voiceSettingsRef = useRef(voiceSettings);
  const { peerStatusesByParticipantId, setPeerStatus, removePeerStatus } =
    useVoicePeerStatuses();
  const {
    remoteStreamsByParticipantId,
    getRemoteStream,
    hasRemoteStream,
    setRemoteStream,
    removeRemoteStream,
    clearRemoteStreams
  } = useRemoteVoiceStreams();
  const {
    speakingParticipantIds,
    resumeVoiceActivityAudioContext,
    startVoiceActivityMonitor,
    stopVoiceActivityMonitor,
    clearSpeakingParticipants
  } = useVoiceActivityMonitor();
  const {
    voiceLifecycleState,
    isVoiceConnecting,
    beginVoiceOperation,
    invalidateVoiceOperations,
    isCurrentVoiceOperation,
    setVoiceLifecycle,
    getCurrentVoiceOperationId
  } = useVoiceLifecycle();
  const { rememberCandidateType, getCandidateTypes, forgetCandidateTypes } =
    useVoiceIceCandidates();
  const {
    queuePendingIceCandidate,
    getPendingIceCandidates,
    forgetPendingIceCandidates
  } = usePendingVoiceIceCandidates();
  const { setVideoSender, getVideoSender, removeVideoSender } =
    useVoiceVideoSenders();
  const {
    getPeerConnection,
    hasPeerConnection,
    setPeerConnection,
    getPeerConnectionIds,
    getPeerConnectionsSnapshot,
    isCurrentPeerConnection,
    closePeerConnection
  } = useVoicePeerConnections();
  const connectionDiagnostics = useVoiceConnectionDiagnostics({
    connectedChannel,
    connectionTargetChannel,
    lifecycleState: voiceLifecycleState,
    voiceSettings,
    getPeerConnection,
    getPeerConnectionsSnapshot
  });
  const [voiceError, setVoiceError] = useState<string | null>(null);

  function getConnectionCuePlayer() {
    connectionCuePlayerRef.current ??= createVoiceConnectionCuePlayer();
    return connectionCuePlayerRef.current;
  }

  function getVoiceStateUpdateSynchronizer() {
    voiceStateUpdateSynchronizerRef.current ??=
      createVoiceStateUpdateSynchronizer({
        isCurrentGeneration: ({ participantId, spaceId }) =>
          normalizeUserId(localParticipantIdRef.current ?? '') ===
            normalizeUserId(participantId) &&
          normalizeUserId(connectedChannelRef.current?.spaceId ?? '') ===
            normalizeUserId(spaceId),
        send: async (request) => {
          const connection = connectionRef.current;
          if (connection?.state !== signalR.HubConnectionState.Connected) {
            throw new Error('Voice transport is not connected.');
          }
          await connection.invoke<boolean>(
            'UpdateVoiceState',
            request.spaceId,
            request.isMuted,
            request.isDeafened,
            request.isCameraEnabled,
            request.isScreenSharing,
            request.participantId
          );
        }
      });
    return voiceStateUpdateSynchronizerRef.current;
  }

  function playPrivateCallConnectedCue(call: PrivateCallState) {
    const channel = connectedChannelRef.current;
    if (
      channel?.channelScope !== 'private' ||
      channel.spaceId.toLowerCase() !== call.spaceId.toLowerCase() ||
      !localParticipantIdRef.current ||
      !call.participantUserIds.some(
        (userId) => normalizeUserId(userId) === normalizedCurrentUserId
      ) ||
      privateCallConnectedCueIdsRef.current.has(call.callId.toLowerCase())
    ) {
      return;
    }

    privateCallConnectedCueIdsRef.current.add(call.callId.toLowerCase());
    void getConnectionCuePlayer().play('connected', voiceSettingsRef.current);
  }

  const privateCallLifecycle = usePrivateCallLifecycle({
    currentUserId,
    voiceSettings,
    locallyConnectedPrivateSpaceId:
      connectedChannel?.channelScope === 'private'
        ? connectedChannel.spaceId
        : null,
    onCallBecameActive: playPrivateCallConnectedCue
  });

  function handlePrivateCallState(call: PrivateCallState) {
    privateCallLifecycle.applyPrivateCallState(call);
    if (call.phase === 'ended') {
      privateCallConnectedCueIdsRef.current.delete(call.callId.toLowerCase());
    }
    if (
      localPrivateCallIdRef.current?.toLowerCase() ===
        call.callId.toLowerCase() &&
      shouldDisconnectForPrivateCallState(
        call,
        connectedChannelRef.current?.channelScope === 'private'
          ? connectedChannelRef.current.spaceId
          : null
      )
    ) {
      const operationId = beginVoiceOperation('leaving');
      void disconnectLocalVoiceSession(operationId, 'idle');
    }
  }

  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  useEffect(() => {
    return () => {
      const cuePlayer = connectionCuePlayerRef.current;
      connectionCuePlayerRef.current = null;
      void cuePlayer?.dispose();
      voiceStateUpdateSynchronizerRef.current?.dispose();
      voiceStateUpdateSynchronizerRef.current = null;
    };
  }, []);
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
    replaceVideoTrackForPeer
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
      isScreenSharing
    }) => {
      const channel = connectedChannelRef.current;
      const participantId = localParticipantIdRef.current;
      if (channel && participantId) {
        getVoiceStateUpdateSynchronizer().enqueue({
          participantId,
          spaceId: channel.spaceId,
          isMuted,
          isDeafened,
          isCameraEnabled,
          isScreenSharing
        });
      }
    },
    startVoiceActivityMonitor,
    resumeVoiceActivityAudioContext,
    stopVoiceActivityMonitor,
    clearRemoteStreams,
    clearSpeakingParticipants
  });
  const {
    localParticipantId,
    participantsBySpaceId,
    setParticipantsBySpaceId,
    isCurrentVoiceParticipant,
    setLocalVoiceParticipantId,
    markSpaceStale,
    markSpaceFresh,
    removeCurrentUserFromSpace,
    sanitizeVoiceParticipants
  } = useVoiceParticipantMembership({
    currentUserId: normalizedCurrentUserId,
    localParticipantIdRef,
    getConnectedChannel: () => connectedChannelRef.current,
    getLocalActivityStream,
    startVoiceActivityMonitor: startLocalVoiceActivityMonitor,
    stopVoiceActivityMonitor
  });
  const {
    syncPeers,
    ensurePeerConnection,
    renegotiatePeer,
    recoverPeer,
    closePeerIfCurrent,
    closeAllPeers,
    updatePeerStatus
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
    setVoiceError
  });
  const { handleVoiceSignal, sendVoiceSignal } = useVoiceSignalingController({
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
    setVoiceError
  });

  function recoverMissingRemoteVideo(
    spaceId: string,
    participants: VoiceParticipant[]
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
      debug: voiceDebug
    });
  }

  async function disconnectLocalVoiceSession(
    operationId = getCurrentVoiceOperationId(),
    nextState: VoiceLifecycleState = 'idle'
  ) {
    if (!isCurrentVoiceOperation(operationId)) {
      return;
    }

    const channel = connectedChannelRef.current;
    const localPrivateCallId = localPrivateCallIdRef.current;
    const hadActiveSession = Boolean(channel && localParticipantIdRef.current);
    pendingConnectionReplacementsRef.current = [];
    pendingVoiceAccessRevocationsRef.current = [];
    voiceStateUpdateSynchronizerRef.current?.invalidate();
    if (channel) {
      markSpaceStale(channel.spaceId);
      removeCurrentUserFromSpace(channel.spaceId);
    }
    connectedChannelRef.current = null;
    localPrivateCallIdRef.current = null;
    if (localPrivateCallId) {
      privateCallConnectedCueIdsRef.current.delete(
        localPrivateCallId.toLowerCase()
      );
    }
    setConnectionTargetChannel(null);
    setLocalVoiceParticipantId(null);
    setConnectedChannel(null);
    remoteVideoRecoveryLastAttemptRef.current = {};
    closeAllPeers();
    await disableCamera();
    await disableScreenShare();
    stopLocalStream();
    setVoiceLifecycle(nextState);
    if (hadActiveSession) {
      void getConnectionCuePlayer().play(
        'disconnected',
        voiceSettingsRef.current
      );
    }
  }

  async function acceptLocalVoiceParticipantId(participantId: string) {
    setLocalVoiceParticipantId(participantId);
    const wasReplaced = resolvePendingVoiceConnectionReplacements(
      pendingConnectionReplacementsRef.current,
      participantId
    );
    pendingConnectionReplacementsRef.current = [];
    const wasRevoked = resolvePendingVoiceAccessRevocations(
      pendingVoiceAccessRevocationsRef.current,
      connectedChannelRef.current,
      participantId
    );
    pendingVoiceAccessRevocationsRef.current = [];
    if (!wasReplaced && !wasRevoked) {
      const channel = connectedChannelRef.current;
      if (channel) {
        enqueueAcceptedVoiceGenerationState(
          getVoiceStateUpdateSynchronizer(),
          participantId,
          channel.spaceId,
          getLocalVoiceState
        );
      }
      return false;
    }

    voiceDebug(
      wasRevoked
        ? 'channel:pending-access-revocation-matched'
        : 'channel:pending-replacement-matched',
      { participantId }
    );
    const replacementOperationId = beginVoiceOperation('leaving');
    await disconnectLocalVoiceSession(replacementOperationId, 'idle');
    return true;
  }

  useVoiceHubConnectionLifecycle({
    accessToken,
    currentUserId,
    connectionRef,
    connectedChannelRef,
    localParticipantIdRef,
    pendingConnectionReplacementsRef,
    pendingVoiceAccessRevocationsRef,
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
    getCurrentVoiceOperationId,
    isCurrentVoiceOperation,
    setVoiceLifecycle,
    getLocalVoiceState,
    enforceServerMediaCapabilities,
    setLocalVoiceParticipantId,
    acceptLocalVoiceParticipantId,
    invalidateVoiceOperations,
    stopLocalStream,
    onPrivateCallState: handlePrivateCallState,
    onIncomingPrivateCallsSnapshot:
      privateCallLifecycle.replaceIncomingPrivateCalls,
    onLocalPrivateCallRestored: (call) => {
      localPrivateCallIdRef.current = call.callId;
    }
  });

  async function ensureConnection() {
    const connection = connectionRef.current;
    if (!connection) {
      return null;
    }

    if (connection.state === signalR.HubConnectionState.Connected) {
      return connection;
    }

    if (connection.state === signalR.HubConnectionState.Disconnected) {
      await connection.start();
    }

    if (
      connection.state === signalR.HubConnectionState.Connecting ||
      connection.state === signalR.HubConnectionState.Reconnecting
    ) {
      await waitForConnected(connection);
    }

    const state = connection.state as signalR.HubConnectionState;

    return state === signalR.HubConnectionState.Connected ? connection : null;
  }

  async function refreshServerVoiceStates(
    serverId: string,
    spaceIds: string[]
  ) {
    const uniqueSpaceIds = Array.from(new Set(spaceIds.filter(Boolean)));
    if (uniqueSpaceIds.length === 0) {
      return;
    }

    let connection: signalR.HubConnection | null;
    try {
      connection = await ensureConnection();
    } catch (error) {
      voiceDebug('state:refresh-connection-failed', {
        serverId,
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    if (!connection) {
      return;
    }

    await Promise.all(
      uniqueSpaceIds.map((spaceId) =>
        invokeGetVoiceChannelState(connection, {
          serverId,
          spaceId,
          title: '',
          channelScope: 'server'
        }).catch((error) => {
          voiceDebug('state:refresh-failed', {
            serverId,
            spaceId,
            message: error instanceof Error ? error.message : String(error)
          });
        })
      )
    );
  }

  async function connectVoiceChannel(
    channel: ConnectedVoiceChannel,
    explicitPrivateCallId?: string
  ) {
    let operationConnection: signalR.HubConnection | null = null;
    let joinedParticipant = false;
    requestVoicePlaybackUnlock();
    const cuePlayer = getConnectionCuePlayer();
    const previousChannel = connectedChannelRef.current;
    const isSwitchingVoiceChannel = Boolean(
      previousChannel && previousChannel.spaceId !== channel.spaceId
    );
    if (isSwitchingVoiceChannel) {
      // A direct channel switch has no leave cue. Stop any remaining entrance
      // tail before the next join so two cues can never overlap.
      cuePlayer.stop();
    }
    cuePlayer.prime(voiceSettingsRef.current);
    if (channel.channelScope === 'private') {
      privateCallLifecycle.primePrivateCallAudio();
    }
    setConnectionTargetChannel(channel);
    const operationId = beginVoiceOperation(
      isSwitchingVoiceChannel ? 'switching' : 'joining'
    );
    if (isSwitchingVoiceChannel) {
      // Enter queue mode until the server returns this generation's id. An old
      // replacement event must not compare against the previous channel's id.
      pendingConnectionReplacementsRef.current = [];
      pendingVoiceAccessRevocationsRef.current = [];
      voiceStateUpdateSynchronizerRef.current?.invalidate();
      setLocalVoiceParticipantId(null);
    }
    setVoiceError(null);

    try {
      // Start media capture while the join/accept click still owns browser user
      // activation. Waiting for SignalR first can leave AudioContext suspended and
      // produce a connected session with a silent outbound track until rejoin.
      // Resolve relay credentials in parallel so Production still fails closed
      // before any participant joins without delaying browser media activation.
      const [preparedJoin] = await Promise.all([
        prepareVoiceJoinMedia(ensureConnection, ensureLocalStream),
        getPeerConfiguration()
      ]);
      const connection = preparedJoin.connection;
      operationConnection = connection;
      if (preparedJoin.error) {
        throw preparedJoin.error;
      }
      if (!isCurrentVoiceOperation(operationId)) {
        return;
      }
      if (!connection) {
        throw new Error(voiceCopy.errors.microphoneConnectFailed);
      }

      if (previousChannel && previousChannel.spaceId !== channel.spaceId) {
        markSpaceStale(previousChannel.spaceId);
        removeCurrentUserFromSpace(previousChannel.spaceId);
        closeAllPeers();
      }
      connectedChannelRef.current = channel;
      setConnectedChannel(channel);
      voiceDebug('channel:join', channel);
      configureVoiceConnectionTimeout(connection, channel.channelScope);
      const localVoiceState = getLocalVoiceState();
      const incomingCall =
        channel.channelScope === 'private'
          ? privateCallLifecycle.incomingPrivateCalls.find(
              (call) =>
                call.spaceId.toLowerCase() === channel.spaceId.toLowerCase()
            )
          : null;
      const serverCall =
        channel.channelScope === 'private' &&
        !explicitPrivateCallId &&
        !incomingCall
          ? await invokeGetPrivateCallState(connection, channel.spaceId)
          : null;
      if (serverCall) {
        privateCallLifecycle.applyPrivateCallState(serverCall);
      }
      const serverIncomingCallId = serverCall?.ringingUserIds.some(
        (userId) => normalizeUserId(userId) === normalizedCurrentUserId
      )
        ? serverCall.callId
        : null;
      const privateCallId =
        explicitPrivateCallId ?? incomingCall?.callId ?? serverIncomingCallId;
      const privateCallResult: PrivateCallJoinResult | null =
        channel.channelScope === 'private'
          ? await (privateCallId
              ? invokeAcceptPrivateCall(
                  connection,
                  channel.spaceId,
                  privateCallId,
                  localVoiceState
                )
              : invokeStartPrivateCall(
                  connection,
                  channel.spaceId,
                  localVoiceState
                ))
          : null;
      const participantId =
        privateCallResult?.participantId ??
        (channel.channelScope === 'server'
          ? await invokeJoinVoiceChannel(connection, channel, localVoiceState)
          : null);
      joinedParticipant = Boolean(participantId);
      if (!isCurrentVoiceOperation(operationId)) {
        if (
          participantId &&
          connection.state === signalR.HubConnectionState.Connected
        ) {
          await leaveStaleVoiceJoin(connection, channel);
        }
        return;
      }

      if (!participantId) {
        await disconnectLocalVoiceSession(operationId, 'error');
        setVoiceError(voiceCopy.errors.joinFailed);
        throw new Error(voiceCopy.errors.joinFailed);
      }

      if (await acceptLocalVoiceParticipantId(participantId)) {
        return false;
      }
      if (channel.channelScope === 'server') {
        localPrivateCallIdRef.current = null;
      }
      if (privateCallResult) {
        localPrivateCallIdRef.current = privateCallResult.callId;
        const authoritativeCall = await invokeGetPrivateCallState(
          connection,
          channel.spaceId
        );
        if (
          !authoritativeCall ||
          authoritativeCall.callId.toLowerCase() !==
            privateCallResult.callId.toLowerCase() ||
          authoritativeCall.phase === 'ended'
        ) {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection
              .invoke('LeaveVoiceChannel', channel.spaceId)
              .catch(() => undefined);
            await leavePreviousVoiceChannelAfterFailedSwitch(
              connection,
              previousChannel,
              channel
            );
          }
          joinedParticipant = false;
          await disconnectLocalVoiceSession(operationId, 'idle');
          setVoiceError(voiceCopy.errors.joinFailed);
          return false;
        }
        privateCallLifecycle.applyPrivateCallState(authoritativeCall);
        if (authoritativeCall.phase === 'active') {
          playPrivateCallConnectedCue(authoritativeCall);
        }
      }
      await invokeGetVoiceChannelState(connection, channel);
      if (isCurrentVoiceOperation(operationId)) {
        markSpaceFresh(channel.spaceId);
        setVoiceLifecycle('connected');
        setConnectionTargetChannel(null);
        if (privateCallResult?.phase === 'active') {
          playPrivateCallConnectedCue(privateCallResult.call);
        } else if (channel.channelScope === 'server') {
          void cuePlayer.play('connected', voiceSettingsRef.current);
        }
        return true;
      }
      return false;
    } catch (error) {
      if (!isCurrentVoiceOperation(operationId)) {
        return;
      }

      const cleanupConnection = operationConnection ?? connectionRef.current;
      if (cleanupConnection?.state === signalR.HubConnectionState.Connected) {
        if (joinedParticipant) {
          await cleanupConnection
            .invoke('LeaveVoiceChannel', channel.spaceId)
            .catch(() => undefined);
        }
        await leavePreviousVoiceChannelAfterFailedSwitch(
          cleanupConnection,
          previousChannel,
          channel
        );
      }

      await disconnectLocalVoiceSession(operationId, 'error');
      setVoiceError(
        error instanceof VoiceIceCredentialsError
          ? voiceCopy.errors.turnCredentialsUnavailable
          : error instanceof Error
            ? error.message
            : voiceCopy.errors.microphoneConnectFailed
      );
      return false;
    }
  }

  async function leaveVoiceChannel() {
    const operationId = beginVoiceOperation('leaving');
    setConnectionTargetChannel(null);
    const channel = connectedChannelRef.current;
    const connection = connectionRef.current;

    if (channel) {
      markSpaceStale(channel.spaceId);
      removeCurrentUserFromSpace(channel.spaceId);
    }

    try {
      if (
        channel &&
        connection?.state === signalR.HubConnectionState.Connected
      ) {
        voiceDebug('channel:leave', channel);
        if (channel.channelScope === 'private') {
          const outgoingCall = privateCallLifecycle.privateCalls.find(
            (call) =>
              call.spaceId.toLowerCase() === channel.spaceId.toLowerCase() &&
              call.phase === 'ringing' &&
              normalizeUserId(call.caller.userId) === normalizedCurrentUserId &&
              call.ringingUserIds.length > 0
          );
          if (outgoingCall) {
            const cancelled = await invokeCancelPrivateCall(
              connection,
              channel.spaceId,
              outgoingCall.callId
            ).catch(() => false);
            if (cancelled) {
              privateCallLifecycle.dismissPrivateCall(outgoingCall.callId);
            }
          }
        }
        await connection.invoke('LeaveVoiceChannel', channel.spaceId);
      }
    } finally {
      await disconnectLocalVoiceSession(operationId, 'idle');
    }
  }

  async function joinVoiceChannel(channel: ConnectedVoiceChannel) {
    await connectVoiceChannel(channel);
  }

  async function acceptPrivateCall({
    callId,
    spaceId,
    title
  }: {
    callId: string;
    spaceId: string;
    title: string;
  }) {
    const accepted = await connectVoiceChannel(
      { serverId: null, spaceId, title, channelScope: 'private' },
      callId
    );
    if (!accepted) throw new Error(voiceCopy.errors.joinFailed);
  }

  async function declinePrivateCall(callId: string, spaceId: string) {
    privateCallLifecycle.primePrivateCallAudio();
    const connection = await ensureConnection();
    if (!connection) return false;
    const declined = await invokeDeclinePrivateCall(
      connection,
      spaceId,
      callId
    );
    if (declined) privateCallLifecycle.dismissPrivateCall(callId);
    return declined;
  }

  async function moveVoiceParticipant(
    serverId: string,
    sourceSpaceId: string,
    targetSpaceId: string,
    participantId: string
  ) {
    if (sourceSpaceId === targetSpaceId) {
      return;
    }

    const connection = await ensureConnection();
    if (!connection) {
      return;
    }

    await connection.invoke(
      'MoveVoiceParticipant',
      serverId,
      sourceSpaceId,
      targetSpaceId,
      participantId
    );
  }

  async function updateVoiceParticipantModeration({
    serverId,
    spaceId,
    participantId,
    isServerMuted,
    isServerDeafened
  }: {
    serverId: string;
    spaceId: string;
    participantId: string;
    isServerMuted?: boolean;
    isServerDeafened?: boolean;
  }) {
    const connection = await ensureConnection();
    if (!connection) {
      return false;
    }

    return invokeUpdateVoiceParticipantModeration(connection, {
      serverId,
      spaceId,
      participantId,
      isServerMuted,
      isServerDeafened
    });
  }

  async function disconnectVoiceParticipant({
    serverId,
    spaceId,
    participantId
  }: {
    serverId: string;
    spaceId: string;
    participantId: string;
  }) {
    const connection = await ensureConnection();
    if (!connection) {
      return false;
    }

    return invokeDisconnectVoiceParticipant(connection, {
      serverId,
      spaceId,
      participantId
    });
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
    privateCalls: privateCallLifecycle.privateCalls,
    incomingPrivateCalls: privateCallLifecycle.incomingPrivateCalls,
    refreshServerVoiceStates,
    joinVoiceChannel,
    acceptPrivateCall,
    declinePrivateCall,
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
    toggleScreenShare
  };
}

export type VoiceChannelController = ReturnType<typeof useVoiceChannel>;
