import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type {
  FriendUserResponse,
  PrivateSpaceResponse,
} from '../../../../shared/types'
import { VoiceCallControlPanel } from '../../../Server/components/voice/controls/VoiceCallControlPanel'
import { SystemIcon, voiceCopy } from '../../../shared'
import type {
  VoiceParticipant,
  VoicePeerStatus,
} from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import styles from './PrivateVoice.module.css'

type PrivateVoiceContextMenuState = {
  participant: VoiceParticipant
  x: number
  y: number
}

export function PrivateVoiceStrip({
  currentUserId,
  localParticipantId,
  participants,
  privateSpace,
  localPreviewStream,
  remoteStreamsByParticipantId,
  peerStatusesByParticipantId,
  speakingParticipantIds,
  hasLocalAudioTrack,
  error,
  isMuted,
  isDeafened,
  isCameraEnabled,
  isScreenSharing,
  audioSettingsByUserId,
  playbackStatesByParticipantId,
  onChangeAudioSettings,
  onToggleMuted,
  onToggleDeafened,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveVoiceChannel,
}: {
  currentUserId: string
  localParticipantId: string | null
  participants: VoiceParticipant[]
  privateSpace: PrivateSpaceResponse
  localPreviewStream: MediaStream | null
  remoteStreamsByParticipantId: Record<string, MediaStream>
  peerStatusesByParticipantId: Record<string, VoicePeerStatus>
  speakingParticipantIds: Record<string, boolean>
  hasLocalAudioTrack: boolean
  error: string | null
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  playbackStatesByParticipantId: Record<string, VoicePlaybackState>
  onChangeAudioSettings: (
    participantId: string,
    patch: Partial<VoiceUserAudioSettings>,
  ) => void
  onToggleMuted: () => void
  onToggleDeafened: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeaveVoiceChannel: () => void
}) {
  const [contextMenu, setContextMenu] =
    useState<PrivateVoiceContextMenuState | null>(null)
  const memberByUserId = new Map(
    privateSpace.members.map((member) => [
      normalizePrivateVoiceId(member.userId),
      member,
    ]),
  )

  function getAudioSettings(userId: string) {
    return (
      audioSettingsByUserId[normalizePrivateVoiceId(userId)] ?? {
        volume: 1,
        isMuted: false,
        isVideoHidden: false,
      }
    )
  }

  function openParticipantMenu(
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
  ) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      participant,
      x: event.clientX,
      y: event.clientY,
    })
  }

  return (
    <section
      className={styles.privateVoiceStrip}
      aria-label={voiceCopy.channel.privateVoiceCall}
    >
      {error && <p className={styles.privateVoiceError}>{error}</p>}

      <div className={styles.privateVoiceParticipants}>
        {participants.map((participant) => {
          const participantId = normalizePrivateVoiceId(participant.participantId)
          const userId = normalizePrivateVoiceId(participant.userId)
          const isSelf =
            participantId === localParticipantId ||
            userId === normalizePrivateVoiceId(currentUserId)
          const stream = isSelf
            ? localPreviewStream
            : remoteStreamsByParticipantId[participantId]
          const hasVideo = Boolean(stream?.getVideoTracks().length)
          const member = memberByUserId.get(userId)
          const isDirectPeer =
            privateSpace.kind === 'direct' && !isSelf && Boolean(member)
          const displayName =
            isDirectPeer && privateSpace.viewerSettings.customNickname
              ? privateSpace.viewerSettings.customNickname
              : participant.displayName
          const avatarUser =
            isDirectPeer &&
            member &&
            privateSpace.viewerSettings.customAvatarAssetId
              ? {
                  ...member.user,
                  avatarAssetId:
                    privateSpace.viewerSettings.customAvatarAssetId,
                  avatarCropOffsetX:
                    privateSpace.viewerSettings.customAvatarCropOffsetX,
                  avatarCropOffsetY:
                    privateSpace.viewerSettings.customAvatarCropOffsetY,
                  avatarCropZoom:
                    privateSpace.viewerSettings.customAvatarCropZoom,
                }
              : member?.user
          const status = getPrivateVoiceParticipantStatus(
            participant,
            peerStatusesByParticipantId[participantId],
            playbackStatesByParticipantId[participantId],
            isSelf,
            hasLocalAudioTrack,
          )

          return (
            <article
              key={participant.participantId}
              className={`${styles.privateVoiceParticipant} ${
                speakingParticipantIds[participantId] ? styles.speaking : ''
              } ${hasVideo ? styles.withVideo : ''}`}
              onContextMenu={(event) => {
                if (!isSelf) {
                  openParticipantMenu(event, participant)
                }
              }}
            >
              {stream && hasVideo ? (
                <PrivateVoiceVideo stream={stream} isMuted />
              ) : (
                <PrivateVoiceAvatar
                  displayName={displayName}
                  user={avatarUser}
                />
              )}
              <div>
                <strong className="ui-ellipsis">{displayName}</strong>
                <small className="ui-ellipsis">{status}</small>
              </div>
            </article>
          )
        })}
      </div>

      <VoiceCallControlPanel
        className={styles.privateVoiceCallPanel}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isCameraEnabled={isCameraEnabled}
        isScreenSharing={isScreenSharing}
        onToggleMuted={onToggleMuted}
        onToggleDeafened={onToggleDeafened}
        onToggleCamera={onToggleCamera}
        onToggleScreenShare={onToggleScreenShare}
        onLeaveVoiceChannel={onLeaveVoiceChannel}
      />

      {contextMenu && (
        <PrivateVoiceParticipantMenu
          x={contextMenu.x}
          y={contextMenu.y}
          participant={contextMenu.participant}
          settings={getAudioSettings(contextMenu.participant.userId)}
          hasRemoteStream={Boolean(
            remoteStreamsByParticipantId[
              normalizePrivateVoiceId(contextMenu.participant.participantId)
            ],
          )}
          onChange={(patch) =>
            onChangeAudioSettings(contextMenu.participant.userId, patch)
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  )
}

function PrivateVoiceVideo({
  stream,
  isMuted,
}: {
  stream: MediaStream
  isMuted: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.srcObject = stream
  }, [stream])

  return (
    <video
      ref={videoRef}
      className={styles.privateVoiceVideo}
      autoPlay
      playsInline
      muted={isMuted}
    />
  )
}

function PrivateVoiceAvatar({
  displayName,
  user,
}: {
  displayName: string
  user: FriendUserResponse | undefined
}) {
  const avatarUrl = user?.avatarAssetId
    ? `/api/assets/${user.avatarAssetId}/content`
    : null

  return (
    <span className={styles.privateVoiceAvatar} aria-hidden="true">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            transform: `translate(${(user?.avatarCropOffsetX ?? 0) * 100}%, ${
              (user?.avatarCropOffsetY ?? 0) * 100
            }%) scale(${user?.avatarCropZoom ?? 1})`,
          }}
        />
      ) : (
        displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

function PrivateVoiceParticipantMenu({
  x,
  y,
  participant,
  settings,
  hasRemoteStream,
  onChange,
  onClose,
}: {
  x: number
  y: number
  participant: VoiceParticipant
  settings: VoiceUserAudioSettings
  hasRemoteStream: boolean
  onChange: (patch: Partial<VoiceUserAudioSettings>) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const left = Math.min(Math.max(8, x), window.innerWidth - 288)
  const top = Math.min(Math.max(8, y), window.innerHeight - 210)

  useDismissableLayer({
    isOpen: true,
    layerRef: menuRef,
    onDismiss: onClose,
  })

  return (
    <div
      ref={menuRef}
      className={styles.privateVoiceMenu}
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <header>
        <strong>{participant.displayName}</strong>
        <small>@{participant.login}</small>
      </header>

      <label>
        <input
          name={`mutePrivateParticipant-${participant.participantId}`}
          type="checkbox"
          checked={settings.isMuted}
          disabled={!hasRemoteStream}
          onChange={(event) => onChange({ isMuted: event.target.checked })}
        />
        <span>{voiceCopy.participantMenu.localMute}</span>
      </label>

      <label className={styles.privateVoiceVolume}>
        <span>{voiceCopy.participantMenu.volume}</span>
        <strong>{Math.round(settings.volume * 100)}%</strong>
        <input
          name={`privateParticipantVolume-${participant.participantId}`}
          type="range"
          min="0"
          max="200"
          step="5"
          value={Math.round(settings.volume * 100)}
          disabled={!hasRemoteStream || settings.isMuted}
          onChange={(event) =>
            onChange({ volume: Number(event.target.value) / 100 })
          }
        />
      </label>

      {!hasRemoteStream && <p>{voiceCopy.participantMenu.audioStreamMissing}</p>}

      <button type="button" onClick={onClose}>
        {voiceCopy.participantMenu.close}
      </button>
    </div>
  )
}

function getPrivateVoiceParticipantStatus(
  participant: VoiceParticipant,
  peerStatus: VoicePeerStatus | undefined,
  playbackState: VoicePlaybackState | undefined,
  isSelf: boolean,
  hasLocalAudioTrack: boolean,
) {
  if (isSelf && !hasLocalAudioTrack) {
    return voiceCopy.participantMenu.microphoneMissing
  }

  if (participant.isScreenSharing) {
    return voiceCopy.participantMenu.screenShare
  }

  if (participant.isCameraEnabled) {
    return voiceCopy.participantMenu.cameraEnabled
  }

  if (participant.isDeafened) {
    return voiceCopy.participantMenu.soundOff
  }

  if (participant.isMuted) {
    return voiceCopy.participantMenu.microphoneOff
  }

  if (isSelf) {
    return voiceCopy.participantMenu.you
  }

  if (!peerStatus) {
    return voiceCopy.participantMenu.waitingWebRtc
  }

  if (!peerStatus.hasRemoteStream) {
    return `${peerStatus.connectionState}/${peerStatus.iceConnectionState}`
  }

  if (playbackState === 'blocked') {
    return voiceCopy.participantMenu.audioNeedsEnable
  }

  if (playbackState === 'playing') {
    return voiceCopy.participantMenu.audioPlaying
  }

  return voiceCopy.participantMenu.audioConnected
}

function normalizePrivateVoiceId(value: string) {
  return value.trim().toLowerCase()
}

export function PrivateSpaceHeaderActions({
  isVoiceConnected,
  isCameraEnabled,
  isVoiceConnecting,
  canUseVoice,
  isInviteOpen,
  onToggleCall,
  onToggleCamera,
  onOpenInvite,
}: {
  isVoiceConnected: boolean
  isCameraEnabled: boolean
  isVoiceConnecting: boolean
  canUseVoice: boolean
  isInviteOpen: boolean
  onToggleCall: () => void
  onToggleCamera: () => void
  onOpenInvite: () => void
}) {
  return (
    <>
      <button
        className={`${styles.privateHeaderAction} ${
          isVoiceConnected ? styles.active : ''
        }`}
        type="button"
        disabled={!canUseVoice || isVoiceConnecting}
        aria-label={
          isVoiceConnected ? voiceCopy.controls.leaveCall : voiceCopy.controls.joinCall
        }
        title={
          isVoiceConnected ? voiceCopy.controls.leaveCall : voiceCopy.controls.joinCall
        }
        onClick={onToggleCall}
      >
        <SystemIcon name="phone-call" size={16} />
      </button>
      <button
        className={`${styles.privateHeaderAction} ${
          isCameraEnabled ? styles.active : ''
        }`}
        type="button"
        disabled={!canUseVoice || isVoiceConnecting}
        aria-label={
          !isVoiceConnected
            ? voiceCopy.controls.startVideoCall
            : isCameraEnabled
              ? voiceCopy.controls.cameraOff
              : voiceCopy.controls.cameraOn
        }
        title={
          !isVoiceConnected
            ? voiceCopy.controls.startVideoCall
            : isCameraEnabled
              ? voiceCopy.controls.cameraOff
              : voiceCopy.controls.cameraOn
        }
        onClick={onToggleCamera}
      >
        <SystemIcon name="camera" size={16} />
      </button>
      <button
        className={`${styles.privateHeaderAction} ${
          isInviteOpen ? styles.active : ''
        }`}
        type="button"
        aria-label={voiceCopy.controls.inviteParticipant}
        aria-expanded={isInviteOpen}
        aria-haspopup="dialog"
        title={voiceCopy.controls.inviteParticipant}
        onClick={onOpenInvite}
      >
        <SystemIcon name="user-plus" size={16} />
      </button>
    </>
  )
}

export function PrivateMemberAvatar({
  user,
  large = false,
}: {
  user: FriendUserResponse
  large?: boolean
}) {
  const avatarUrl = user.avatarAssetId
    ? `/api/assets/${user.avatarAssetId}/content`
    : null

  return (
    <span
      className={`${styles.privateAvatar} ${large ? styles.largeAvatar : ''}`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            transform: `translate(${user.avatarCropOffsetX * 100}%, ${
              user.avatarCropOffsetY * 100
            }%) scale(${user.avatarCropZoom})`,
          }}
        />
      ) : (
        user.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
