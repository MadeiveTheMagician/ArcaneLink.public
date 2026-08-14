import { useRef } from 'react'
import { normalizeUserId } from './voiceChannelUtils'

export type VoiceVideoSenderKind = 'camera' | 'screen'

export function useVoiceVideoSenders() {
  const videoSendersRef = useRef<
    Record<string, Partial<Record<VoiceVideoSenderKind, RTCRtpSender>>>
  >({})

  function setVideoSender(
    participantId: string,
    kind: VoiceVideoSenderKind,
    sender: RTCRtpSender,
  ) {
    const normalizedParticipantId = normalizeUserId(participantId)

    videoSendersRef.current[normalizedParticipantId] = {
      ...videoSendersRef.current[normalizedParticipantId],
      [kind]: sender,
    }
  }

  function getVideoSender(participantId: string, kind: VoiceVideoSenderKind) {
    return videoSendersRef.current[normalizeUserId(participantId)]?.[kind] ?? null
  }

  function removeVideoSender(participantId: string) {
    delete videoSendersRef.current[normalizeUserId(participantId)]
  }

  return {
    setVideoSender,
    getVideoSender,
    removeVideoSender,
  }
}
