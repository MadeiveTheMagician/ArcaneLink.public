import { useRef } from 'react'
import { describeIceServers } from './voiceChannelConfig'
import { voiceDebug } from './voiceChannelDebug'
import { attachVoicePeerConnectionHandlers } from './voicePeerConnectionHandlers'
import {
  cancelPendingVoiceLocalOffer,
  runVoiceLocalOffer,
} from './voiceLocalOfferGuard'
import type { VoiceVideoSenderKind } from './useVoiceVideoSenders'
import { registerVoiceVideoReceiverTrack } from './voiceVideoTrackKinds'
import type {
  ConnectedVoiceChannel,
  VoiceParticipant,
  VoiceSignalPayload,
} from './voiceChannelTypes'
import { normalizeUserId, shouldCreateOffer } from './voiceChannelUtils'
import { voiceCopy } from '../../../shared/index'

const localOfferAnswerTimeoutMs = 10_000

type SendVoiceSignal = (
  targetParticipantId: string,
  kind: VoiceSignalPayload['kind'],
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit,
) => Promise<boolean>

type UseVoicePeerOrchestratorOptions = {
  getChannel: () => ConnectedVoiceChannel | null
  getLocalParticipantId: () => string | null
  getCurrentVoiceOperationId: () => number
  isCurrentVoiceOperation: (operationId: number) => boolean
  ensureLocalStream: () => Promise<MediaStream>
  getPeerConfiguration: () => Promise<RTCConfiguration>
  syncAudioTrackForPeer: (participantId: string) => Promise<void>
  replaceVideoTrackForPeer: (
    participantId: string,
    kind?: VoiceVideoSenderKind,
  ) => Promise<void>
  sendVoiceSignal: SendVoiceSignal
  getRemoteStream: (participantId: string) => MediaStream | null
  setRemoteStream: (participantId: string, stream: MediaStream) => void
  removeRemoteStream: (participantId: string) => void
  hasRemoteStream: (participantId: string) => boolean
  startVoiceActivityMonitor: (participantId: string, stream: MediaStream) => void
  stopVoiceActivityMonitor: (participantId: string) => void
  rememberCandidateType: (participantId: string, candidateType: string | null) => void
  getCandidateTypes: (participantId: string) => string[]
  forgetCandidateTypes: (participantId: string) => void
  forgetPendingIceCandidates: (participantId: string) => void
  setVideoSender: (
    participantId: string,
    kind: VoiceVideoSenderKind,
    sender: RTCRtpSender,
  ) => void
  getPeerConnection: (participantId: string) => RTCPeerConnection | null
  hasPeerConnection: (participantId: string) => boolean
  setPeerConnection: (
    participantId: string,
    peerConnection: RTCPeerConnection,
  ) => void
  getPeerConnectionIds: () => string[]
  isCurrentPeerConnection: (
    participantId: string,
    peerConnection: RTCPeerConnection,
  ) => boolean
  closePeerConnection: (participantId: string) => void
  removeVideoSender: (participantId: string) => void
  setPeerStatus: (
    participantId: string,
    status: {
      connectionState: RTCPeerConnectionState
      iceConnectionState: RTCIceConnectionState
      signalingState: RTCSignalingState
      hasRemoteStream: boolean
    },
  ) => void
  removePeerStatus: (participantId: string) => void
  setVoiceError: (message: string | null) => void
}

export function useVoicePeerOrchestrator({
  getChannel,
  getLocalParticipantId,
  getCurrentVoiceOperationId,
  isCurrentVoiceOperation,
  ensureLocalStream,
  getPeerConfiguration,
  syncAudioTrackForPeer,
  replaceVideoTrackForPeer,
  sendVoiceSignal,
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
}: UseVoicePeerOrchestratorOptions) {
  const peerCreationPromisesRef = useRef<
    Map<string, Promise<RTCPeerConnection>>
  >(new Map())
  async function sendLocalOfferSignal(
    participantId: string,
    kind: 'offer' | 'renegotiate-offer',
    offer: RTCSessionDescriptionInit,
    peer: RTCPeerConnection,
  ) {
    const normalizedParticipantId = normalizeUserId(participantId)
    let didSend = false
    try {
      didSend = await sendVoiceSignal(normalizedParticipantId, kind, offer)
    } catch (error) {
      voiceDebug('offer:send-failed', {
        participantId: normalizedParticipantId,
        kind,
        message: error instanceof Error ? error.message : String(error),
      })
    }

    if (!isCurrentPeerConnection(normalizedParticipantId, peer)) {
      return false
    }

    if (!didSend) {
      if (peer.signalingState === 'have-local-offer') {
        try {
          await peer.setLocalDescription({ type: 'rollback' })
        } catch (error) {
          voiceDebug('offer:rollback-failed', {
            participantId: normalizedParticipantId,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
      return false
    }

    scheduleLocalOfferWatchdog(normalizedParticipantId, peer)
    return true
  }

  async function createAndSendLocalOffer(
    participantId: string,
    kind: 'offer' | 'renegotiate-offer',
    peer: RTCPeerConnection,
    options: {
      iceRestart?: boolean
      rollbackLocalOffer?: boolean
      isCurrent?: () => boolean
    } = {},
  ) {
    const normalizedParticipantId = normalizeUserId(participantId)
    const isCurrent = () =>
      isCurrentPeerConnection(normalizedParticipantId, peer) &&
      (options.isCurrent?.() ?? true)
    const result = await runVoiceLocalOffer(
      peer,
      async () => {
        if (!isCurrent()) {
          return null
        }
        if (
          options.rollbackLocalOffer &&
          peer.signalingState === 'have-local-offer'
        ) {
          await peer.setLocalDescription({ type: 'rollback' })
        }
        if (peer.signalingState !== 'stable') {
          return null
        }

        if (options.iceRestart) {
          peer.restartIce()
        }
        const offer = options.iceRestart
          ? await peer.createOffer({ iceRestart: true })
          : await peer.createOffer()
        if (!isCurrent() || peer.signalingState !== 'stable') {
          return null
        }

        await peer.setLocalDescription(offer)
        if (!isCurrent()) {
          return null
        }
        return (await sendLocalOfferSignal(
          normalizedParticipantId,
          kind,
          offer,
          peer,
        ))
          ? offer
          : null
      },
      {
        requiresStable: !options.rollbackLocalOffer,
        priority: options.iceRestart ? 'ice-restart' : 'normal',
      },
    )

    return result.status === 'completed' ? result.value : null
  }

  function scheduleLocalOfferWatchdog(
    participantId: string,
    peer: RTCPeerConnection,
  ) {
    if (peer.signalingState !== 'have-local-offer') {
      return
    }

    const expectedOfferSdp = peer.localDescription?.sdp
    window.setTimeout(() => {
      if (
        !isCurrentPeerConnection(participantId, peer) ||
        peer.signalingState !== 'have-local-offer' ||
        peer.localDescription?.sdp !== expectedOfferSdp
      ) {
        return
      }

      voiceDebug('offer:answer-timeout', {
        participantId,
      })
      void restartPeerIce(participantId, peer)
    }, localOfferAnswerTimeoutMs)
  }


  async function syncPeers(spaceId: string, participants: VoiceParticipant[]) {
    const channel = getChannel()
    const localParticipantId = getLocalParticipantId()
    const operationId = getCurrentVoiceOperationId()
    if (!channel || channel.spaceId !== spaceId || !localParticipantId) {
      return
    }

    const remoteParticipants = participants.filter(
      (participant) => normalizeUserId(participant.participantId) !== localParticipantId,
    )
    voiceDebug('peers:sync', {
      spaceId,
      remoteParticipantIds: remoteParticipants.map((participant) =>
        normalizeUserId(participant.participantId),
      ),
      existingPeerIds: getPeerConnectionIds(),
    })
    const remoteParticipantIds = new Set(
      remoteParticipants.map((item) => normalizeUserId(item.participantId)),
    )

    for (const participantId of getPeerConnectionIds()) {
      if (!remoteParticipantIds.has(participantId)) {
        closePeer(participantId)
      }
    }

    for (const participant of remoteParticipants) {
      const remoteParticipantId = normalizeUserId(participant.participantId)

      if (!hasPeerConnection(remoteParticipantId)) {
        const peer = await ensurePeerConnection(participant.participantId)
        if (!isCurrentPeerSync(operationId, spaceId)) {
          closePeerIfCurrent(remoteParticipantId, peer)
          return
        }

        if (shouldCreateOffer(localParticipantId, remoteParticipantId)) {
          const offer = await createAndSendLocalOffer(
            remoteParticipantId,
            'offer',
            peer,
            { isCurrent: () => isCurrentPeerSync(operationId, spaceId) },
          )
          if (!isCurrentPeerSync(operationId, spaceId)) {
            closePeerIfCurrent(remoteParticipantId, peer)
            return
          }
          if (!offer) {
            continue
          }

          voiceDebug('offer:created', {
            targetParticipantId: remoteParticipantId,
            signalingState: peer.signalingState,
            iceGatheringState: peer.iceGatheringState,
          })
        }
      }
    }
  }

  async function ensurePeerConnection(remoteParticipantId: string) {
    const normalizedRemoteParticipantId = normalizeUserId(remoteParticipantId)
    if (normalizedRemoteParticipantId === getLocalParticipantId()) {
      throw new Error('Cannot create a voice peer for the current user.')
    }

    const pendingCreation = peerCreationPromisesRef.current.get(
      normalizedRemoteParticipantId,
    )
    if (pendingCreation) {
      return pendingCreation
    }

    const existing = getPeerConnection(normalizedRemoteParticipantId)
    if (existing) {
      return existing
    }

    const creationPromise = createPeerConnection(normalizedRemoteParticipantId)
    peerCreationPromisesRef.current.set(
      normalizedRemoteParticipantId,
      creationPromise,
    )
    try {
      return await creationPromise
    } finally {
      if (
        peerCreationPromisesRef.current.get(normalizedRemoteParticipantId) ===
        creationPromise
      ) {
        peerCreationPromisesRef.current.delete(normalizedRemoteParticipantId)
      }
    }
  }

  async function createPeerConnection(normalizedRemoteParticipantId: string) {
    const peerConfiguration = await getPeerConfiguration()
    const stream = await ensureLocalStream()
    const existing = getPeerConnection(normalizedRemoteParticipantId)
    if (existing) {
      return existing
    }

    const peer = new RTCPeerConnection(peerConfiguration)
    setPeerConnection(normalizedRemoteParticipantId, peer)
    try {
      voiceDebug('peer:created', {
        remoteParticipantId: normalizedRemoteParticipantId,
        iceServers: describeIceServers(peerConfiguration.iceServers),
        iceTransportPolicy: peerConfiguration.iceTransportPolicy ?? 'all',
      })

      const audioTracks = stream.getAudioTracks()
      audioTracks.forEach((track) => peer.addTrack(track, stream))
      if (audioTracks.length === 0) {
        peer.addTransceiver('audio', {
          direction: 'recvonly',
        })
      }
      await syncAudioTrackForPeer(normalizedRemoteParticipantId)

      const cameraTransceiver = peer.addTransceiver('video', {
        direction: 'sendrecv',
      })
      const screenTransceiver = peer.addTransceiver('video', {
        direction: 'sendrecv',
      })
      registerVoiceVideoReceiverTrack(
        cameraTransceiver.receiver.track,
        'camera',
      )
      registerVoiceVideoReceiverTrack(
        screenTransceiver.receiver.track,
        'screen',
      )
      setVideoSender(
        normalizedRemoteParticipantId,
        'camera',
        cameraTransceiver.sender,
      )
      setVideoSender(
        normalizedRemoteParticipantId,
        'screen',
        screenTransceiver.sender,
      )
      await Promise.all([
        replaceVideoTrackForPeer(normalizedRemoteParticipantId, 'camera'),
        replaceVideoTrackForPeer(normalizedRemoteParticipantId, 'screen'),
      ])
      if (
        !isCurrentPeerConnection(normalizedRemoteParticipantId, peer) ||
        peer.signalingState === 'closed'
      ) {
        throw new Error('Voice peer creation was superseded.')
      }

      attachVoicePeerConnectionHandlers({
        peer,
        remoteParticipantId: normalizedRemoteParticipantId,
        getRemoteStream,
        setRemoteStream,
        startVoiceActivityMonitor,
        rememberCandidateType,
        sendVoiceSignal: (targetParticipantId, kind, payload) =>
          sendVoiceSignal(targetParticipantId, kind, payload),
        updatePeerStatus,
        reportIceFailure,
        closePeer,
        restartPeerIce,
        setVoiceError,
      })
      updatePeerStatus(normalizedRemoteParticipantId)

      return peer
    } catch (error) {
      closePeerIfCurrent(normalizedRemoteParticipantId, peer)
      throw error
    }
  }

  async function renegotiatePeer(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId)
    const peer = getPeerConnection(normalizedParticipantId)

    if (!peer) {
      voiceDebug('renegotiate:skip', {
        participantId: normalizedParticipantId,
        signalingState: undefined,
      })
      return
    }

    const offer = await createAndSendLocalOffer(
      normalizedParticipantId,
      'renegotiate-offer',
      peer,
    )
    if (!offer) {
      return
    }
    voiceDebug('renegotiate:offer-created', {
      targetParticipantId: normalizedParticipantId,
      signalingState: peer.signalingState,
      iceGatheringState: peer.iceGatheringState,
    })
    updatePeerStatus(normalizedParticipantId)
  }

  async function restartPeerIce(
    participantId: string,
    expectedPeer: RTCPeerConnection,
  ) {
    const normalizedParticipantId = normalizeUserId(participantId)
    const channel = getChannel()
    const operationId = getCurrentVoiceOperationId()
    if (
      !channel ||
      !isCurrentPeerSync(operationId, channel.spaceId) ||
      !isCurrentPeerConnection(normalizedParticipantId, expectedPeer)
    ) {
      return
    }

    try {
      const peerConfiguration = await getPeerConfiguration()
      if (
        !isCurrentPeerSync(operationId, channel.spaceId) ||
        !isCurrentPeerConnection(normalizedParticipantId, expectedPeer)
      ) {
        return
      }
      expectedPeer.setConfiguration(peerConfiguration)
      const offer = await createAndSendLocalOffer(
        normalizedParticipantId,
        'renegotiate-offer',
        expectedPeer,
        {
          iceRestart: true,
          rollbackLocalOffer: true,
          isCurrent: () => isCurrentPeerSync(operationId, channel.spaceId),
        },
      )
      if (
        !isCurrentPeerSync(operationId, channel.spaceId) ||
        !isCurrentPeerConnection(normalizedParticipantId, expectedPeer)
      ) {
        return
      }
      if (!offer) {
        voiceDebug('ice:restart-deferred', {
          participantId: normalizedParticipantId,
        })
        return
      }

      updatePeerStatus(normalizedParticipantId)
      voiceDebug('ice:restart-offer-created', {
        participantId: normalizedParticipantId,
        signalingState: expectedPeer.signalingState,
      })
    } catch (error) {
      voiceDebug('ice:restart-failed', {
        participantId: normalizedParticipantId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function recoverPeer(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId)
    const channel = getChannel()
    const localParticipantId = getLocalParticipantId()
    const operationId = getCurrentVoiceOperationId()
    if (!channel || !localParticipantId) {
      return
    }

    const pendingCreation = peerCreationPromisesRef.current.get(
      normalizedParticipantId,
    )
    if (pendingCreation) {
      try {
        await pendingCreation
      } catch {
        // The failed creation cleans its own partially registered peer.
      }
    }
    if (!isCurrentPeerSync(operationId, channel.spaceId)) {
      return
    }

    closePeer(normalizedParticipantId)
    const peer = await ensurePeerConnection(normalizedParticipantId)
    try {
      if (!isCurrentPeerSync(operationId, channel.spaceId)) {
        closePeerIfCurrent(normalizedParticipantId, peer)
        return
      }
      if (!isCurrentPeerConnection(normalizedParticipantId, peer)) {
        closePeerIfCurrent(normalizedParticipantId, peer)
        return
      }

      const offer = await createAndSendLocalOffer(
        normalizedParticipantId,
        'renegotiate-offer',
        peer,
        {
          isCurrent: () => isCurrentPeerSync(operationId, channel.spaceId),
        },
      )
      if (
        !isCurrentPeerSync(operationId, channel.spaceId) ||
        !isCurrentPeerConnection(normalizedParticipantId, peer)
      ) {
        closePeerIfCurrent(normalizedParticipantId, peer)
        return
      }
      if (!offer) {
        return
      }
      updatePeerStatus(normalizedParticipantId)
      voiceDebug('peer:recovered', {
        participantId: normalizedParticipantId,
      })
    } catch (error) {
      closePeerIfCurrent(normalizedParticipantId, peer)
      throw error
    }
  }

  function closePeer(participantId: string) {
    const peer = getPeerConnection(participantId)
    if (peer) {
      cancelPendingVoiceLocalOffer(peer)
    }
    closePeerConnection(participantId)
    voiceDebug('peer:closed', { participantId })
    removeVideoSender(participantId)
    forgetPendingIceCandidates(participantId)
    forgetCandidateTypes(participantId)
    stopVoiceActivityMonitor(participantId)
    removePeerStatus(participantId)
    removeRemoteStream(participantId)
  }

  function closePeerIfCurrent(participantId: string, peer: RTCPeerConnection) {
    const normalizedParticipantId = normalizeUserId(participantId)
    if (isCurrentPeerConnection(normalizedParticipantId, peer)) {
      closePeer(normalizedParticipantId)
    } else {
      cancelPendingVoiceLocalOffer(peer)
      peer.close()
    }
  }

  function closeAllPeers() {
    getPeerConnectionIds().forEach(closePeer)
  }

  function updatePeerStatus(participantId: string) {
    const peer = getPeerConnection(participantId)
    if (!peer) {
      return
    }

    setPeerStatus(participantId, {
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      signalingState: peer.signalingState,
      hasRemoteStream: hasRemoteStream(participantId),
    })
  }

  function reportIceFailure(participantId: string) {
    const normalizedUserId = normalizeUserId(participantId)
    const candidateTypes = getCandidateTypes(normalizedUserId)
    const hasRelayCandidate = candidateTypes.includes('relay')
    const peerConfiguration = getPeerConnection(
      normalizedUserId,
    )?.getConfiguration()

    voiceDebug('ice:failed', {
      participantId: normalizedUserId,
      candidateTypes,
      hasRelayCandidate,
      iceServers: describeIceServers(peerConfiguration?.iceServers),
      iceTransportPolicy: peerConfiguration?.iceTransportPolicy ?? 'all',
    })

    if (!hasRelayCandidate) {
      setVoiceError(voiceCopy.errors.turnRelayMissing)
    }
  }

  function isCurrentPeerSync(operationId: number, spaceId: string) {
    const channel = getChannel()
    return isCurrentVoiceOperation(operationId) && channel?.spaceId === spaceId
  }

  return {
    syncPeers,
    ensurePeerConnection,
    renegotiatePeer,
    recoverPeer,
    closePeer,
    closePeerIfCurrent,
    closeAllPeers,
    updatePeerStatus,
  }
}
