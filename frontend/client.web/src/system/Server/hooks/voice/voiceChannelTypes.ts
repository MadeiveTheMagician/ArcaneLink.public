import type {
  VoiceConnectionQualityState,
} from './voiceConnectionQualityModel'

export type VoiceParticipant = {
  participantId: string
  userId: string
  login: string
  displayName: string
  avatarAssetId?: string | null
  avatarCropOffsetX?: number
  avatarCropOffsetY?: number
  avatarCropZoom?: number
  isMuted: boolean
  isDeafened: boolean
  isServerMuted?: boolean
  isServerDeafened?: boolean
  canSpeak?: boolean
  canUseVideo?: boolean
  canShareScreen?: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  joinedAt: string
}

export type VoicePeerStatus = {
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  signalingState: RTCSignalingState
  hasRemoteStream: boolean
}

export type VoicePeerConnectionDiagnostics = {
  participantId: string
  sampledAtMs: number | null
  intervalMs: number | null
  inboundBitrateBps: number | null
  outboundBitrateBps: number | null
  inboundPacketLossPercent: number | null
  outboundPacketLossPercent: number | null
  packetLossPercent: number | null
  roundTripTimeMs: number | null
  jitterMs: number | null
  qualityState: VoiceConnectionQualityState
  connectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState
  codec: string | null
  route: string | null
}

export type VoiceConnectionDiagnostics = {
  sampledAtMs: number | null
  intervalMs: number | null
  inboundBitrateBps: number | null
  outboundBitrateBps: number | null
  packetLossPercent: number | null
  roundTripTimeMs: number | null
  jitterMs: number | null
  qualityState: VoiceConnectionQualityState
  codec: string | null
  route: string | null
  peerCount: number
  connectedPeerCount: number
  peersByParticipantId: Record<string, VoicePeerConnectionDiagnostics>
}

export type VoiceStatePayload = {
  serverId: string | null
  spaceId: string
  channelScope?: VoiceChannelScope
  participants: VoiceParticipant[]
}

export type VoiceSignalPayload = {
  spaceId: string
  fromUserId: string
  fromParticipantId: string
  kind: 'offer' | 'answer' | 'ice' | 'renegotiate-offer' | 'renegotiate-answer'
  payload: string
}

export type VoiceParticipantMovedPayload = {
  serverId: string | null
  spaceId: string
  targetSpaceId: string
  title: string
  participantId: string
}

export type VoiceConnectionReplacedPayload = {
  serverId?: string | null
  spaceId?: string
  channelScope?: VoiceChannelScope
  participantId?: string
}

export type VoiceAccessRevokedPayload = VoiceConnectionReplacedPayload

export type ConnectedVoiceChannel = {
  serverId: string | null
  spaceId: string
  title: string
  channelScope: VoiceChannelScope
}

export type VoiceChannelScope = 'server' | 'private'

export type VoiceLifecycleState =
  | 'idle'
  | 'joining'
  | 'connected'
  | 'switching'
  | 'reconnecting'
  | 'leaving'
  | 'error'

export type PrivateCallPhase = 'ringing' | 'active' | 'ended'

export type PrivateCallUser = {
  userId: string
  login: string
  displayName: string
}

export type PrivateCallState = {
  callId: string
  spaceId: string
  phase: PrivateCallPhase
  revision: number
  caller: PrivateCallUser
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  participantUserIds: string[]
  ringingUserIds: string[]
  declinedUserIds: string[]
  endReason: string | null
}

export type PrivateCallJoinResult = {
  callId: string
  participantId: string
  phase: PrivateCallPhase
  call: PrivateCallState
}
