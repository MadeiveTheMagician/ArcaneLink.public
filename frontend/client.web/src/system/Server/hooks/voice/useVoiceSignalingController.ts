import * as signalR from '@microsoft/signalr'
import { voiceDebug } from './voiceChannelDebug'
import type {
  ConnectedVoiceChannel,
  VoiceSignalPayload,
} from './voiceChannelTypes'
import { normalizeUserId, shouldCreateOffer } from './voiceChannelUtils'
import {
  flushVoiceLocalOffer,
  isVoicePeerMakingLocalOffer,
} from './voiceLocalOfferGuard'

type UseVoiceSignalingControllerOptions = {
  getChannel: () => ConnectedVoiceChannel | null
  getConnection: () => signalR.HubConnection | null
  getLocalParticipantId: () => string | null
  getCurrentVoiceOperationId: () => number
  isCurrentVoiceOperation: (operationId: number) => boolean
  ensurePeerConnection: (participantId: string) => Promise<RTCPeerConnection>
  closePeerIfCurrent: (
    participantId: string,
    peerConnection: RTCPeerConnection,
  ) => void
  getPeerConnection: (participantId: string) => RTCPeerConnection | null
  getPendingIceCandidates: (participantId: string) => RTCIceCandidateInit[]
  queuePendingIceCandidate: (
    participantId: string,
    candidate: RTCIceCandidateInit,
  ) => void
  forgetPendingIceCandidates: (participantId: string) => void
  rememberCandidateType: (
    participantId: string,
    candidateType: string | null,
  ) => void
  updatePeerStatus: (participantId: string) => void
  setVoiceError: (message: string | null) => void
}

export function useVoiceSignalingController({
  getChannel,
  getConnection,
  getLocalParticipantId,
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
}: UseVoiceSignalingControllerOptions) {
  async function flushPendingIceCandidates(participantId: string) {
    const normalizedParticipantId = normalizeUserId(participantId)
    const peer = getPeerConnection(normalizedParticipantId)
    const candidates = getPendingIceCandidates(normalizedParticipantId)

    if (!peer || candidates.length === 0 || !peer.remoteDescription) {
      return
    }

    forgetPendingIceCandidates(normalizedParticipantId)

    voiceDebug('ice:flush', {
      participantId: normalizedParticipantId,
      count: candidates.length,
    })
    for (const candidate of candidates) {
      const parsedCandidate = new RTCIceCandidate(candidate)
      rememberCandidateType(normalizedParticipantId, parsedCandidate.type)
      await peer.addIceCandidate(parsedCandidate)
    }
  }

  async function sendVoiceSignal(
    targetParticipantId: string,
    kind: VoiceSignalPayload['kind'],
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit,
  ) {
    const channel = getChannel()
    const connection = getConnection()
    const normalizedTargetParticipantId = normalizeUserId(targetParticipantId)

    if (
      !channel ||
      normalizedTargetParticipantId === getLocalParticipantId() ||
      connection?.state !== signalR.HubConnectionState.Connected
    ) {
      return false
    }

    await connection.invoke(
      'SendVoiceSignal',
      channel.spaceId,
      normalizedTargetParticipantId,
      kind,
      JSON.stringify(payload),
    )
    voiceDebug('signal:sent', {
      targetParticipantId: normalizedTargetParticipantId,
      kind,
    })
    return true
  }

  async function handleVoiceSignal(signal: VoiceSignalPayload) {
    const channel = getChannel()
    const fromParticipantId = normalizeUserId(signal.fromParticipantId)
    const operationId = getCurrentVoiceOperationId()

    if (
      !channel ||
      channel.spaceId !== signal.spaceId ||
      fromParticipantId === getLocalParticipantId()
    ) {
      return
    }

    const peer = await ensurePeerConnection(fromParticipantId)
    if (
      !isCurrentVoiceOperation(operationId) ||
      getChannel()?.spaceId !== signal.spaceId
    ) {
      closePeerIfCurrent(fromParticipantId, peer)
      return
    }

    if (signal.kind === 'offer' || signal.kind === 'renegotiate-offer') {
      const offer = JSON.parse(signal.payload) as RTCSessionDescriptionInit
      const localParticipantId = getLocalParticipantId()
      const isMakingLocalOffer = isVoicePeerMakingLocalOffer(peer)
      const hasOfferCollision =
        isMakingLocalOffer || peer.signalingState !== 'stable'

      if (hasOfferCollision) {
        if (localParticipantId && shouldCreateOffer(localParticipantId, fromParticipantId)) {
          voiceDebug('offer:collision-ignored', {
            fromParticipantId,
            isMakingLocalOffer,
            signalingState: peer.signalingState,
          })
          return
        }

        if (peer.signalingState !== 'stable') {
          await peer.setLocalDescription({ type: 'rollback' })
          voiceDebug('offer:collision-rollback', {
            fromParticipantId,
            isMakingLocalOffer,
            signalingState: peer.signalingState,
          })
        }
      }

      await peer.setRemoteDescription(offer)
      if (
        !isCurrentVoiceOperation(operationId) ||
        getChannel()?.spaceId !== signal.spaceId
      ) {
        closePeerIfCurrent(fromParticipantId, peer)
        return
      }

      await flushPendingIceCandidates(fromParticipantId)
      updatePeerStatus(fromParticipantId)
      const answer = await peer.createAnswer()
      if (
        !isCurrentVoiceOperation(operationId) ||
        getChannel()?.spaceId !== signal.spaceId
      ) {
        closePeerIfCurrent(fromParticipantId, peer)
        return
      }

      await peer.setLocalDescription(answer)
      if (
        !isCurrentVoiceOperation(operationId) ||
        getChannel()?.spaceId !== signal.spaceId
      ) {
        closePeerIfCurrent(fromParticipantId, peer)
        return
      }
      voiceDebug('answer:created', {
        targetParticipantId: fromParticipantId,
        signalingState: peer.signalingState,
        iceGatheringState: peer.iceGatheringState,
      })
      updatePeerStatus(fromParticipantId)
      await sendVoiceSignal(
        fromParticipantId,
        signal.kind === 'renegotiate-offer' ? 'renegotiate-answer' : 'answer',
        answer,
      )
      flushVoiceLocalOffer(peer)
      return
    }

    if (signal.kind === 'answer' || signal.kind === 'renegotiate-answer') {
      const answer = JSON.parse(signal.payload) as RTCSessionDescriptionInit
      if (peer.signalingState !== 'stable') {
        await peer.setRemoteDescription(answer)
        if (
          !isCurrentVoiceOperation(operationId) ||
          getChannel()?.spaceId !== signal.spaceId
        ) {
          closePeerIfCurrent(fromParticipantId, peer)
          return
        }

        await flushPendingIceCandidates(fromParticipantId)
        voiceDebug('answer:applied', {
          fromParticipantId,
          signalingState: peer.signalingState,
        })
        updatePeerStatus(fromParticipantId)
        flushVoiceLocalOffer(peer)
      }
      return
    }

    const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit
    const parsedCandidate = new RTCIceCandidate(candidate)
    rememberCandidateType(fromParticipantId, parsedCandidate.type)
    if (parsedCandidate.type === 'relay') {
      setVoiceError(null)
    }
    if (!peer.remoteDescription) {
      voiceDebug('ice:queued', {
        fromParticipantId,
        kind: signal.kind,
      })
      queuePendingIceCandidate(fromParticipantId, candidate)
      updatePeerStatus(fromParticipantId)
      return
    }

    if (
      !isCurrentVoiceOperation(operationId) ||
      getChannel()?.spaceId !== signal.spaceId
    ) {
      closePeerIfCurrent(fromParticipantId, peer)
      return
    }

    await peer.addIceCandidate(parsedCandidate)
    voiceDebug('ice:applied', {
      fromParticipantId,
      candidateType: parsedCandidate.type,
      protocol: parsedCandidate.protocol,
    })
    updatePeerStatus(fromParticipantId)
  }

  return {
    handleVoiceSignal,
    flushPendingIceCandidates,
    sendVoiceSignal,
  }
}
