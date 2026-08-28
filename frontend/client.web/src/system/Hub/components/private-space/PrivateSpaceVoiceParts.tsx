import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type {
  DirectMessageBlockedUserResponse,
  DirectMessageBlockStatusResponse,
  FriendUserResponse,
  PrivateSpaceResponse,
  ServerMemberResponse,
} from '../../../../shared/types'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import { VoiceCallControlPanel } from '../../../Server/components/voice/controls/VoiceCallControlPanel'
import {
  communityCopy,
  dispatchUserBlockChanged,
  getUserBlockedNotice,
  SystemIcon,
  UserBlockDialog,
  type UserBlockDialogTarget,
  voiceCopy,
} from '../../../shared'
import type {
  VoiceParticipant,
  VoicePeerStatus,
} from '../../../Server/hooks/voice/useVoiceChannel'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../shared/types/voicePlayback'
import { ContextMenu } from '../../../shared/components/context-menu/ContextMenu'
import { UserAvatar } from '../direct-messages/DirectMessageAvatar'
import {
  createTrackStream,
  selectParticipantVideoTracks,
} from '../../../Server/components/voice/participants/voiceMediaTracks'
import { useVoiceMediaTrackVersion } from '../../../Server/components/voice/participants/useVoiceMediaTrackVersion'
import {
  buildPrivateVoiceParticipantContextMenuItems,
  isPrivateVoiceContextMenuKey,
} from './privateVoiceParticipantContextMenuItems'
import styles from './PrivateVoice.module.css'

type PrivateVoiceContextMenuState = {
  participant: VoiceParticipant
  x: number
  y: number
}

export function PrivateVoiceStrip({
  accessToken,
  currentUserId,
  localParticipantId,
  participants,
  privateSpace,
  localCameraPreviewStream,
  localScreenPreviewStream,
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
  friendUserIds,
  pendingOutgoingUserIds,
  isMutatingFriends,
  onOpenProfile,
  onMentionUser,
  onOpenDirectSpace,
  onStartDirectVoice,
  onLoadInviteTargetServers,
  onCreateDirectServerInvite,
  onSendFriendRequest,
  onRemoveFriend,
  onChangeAudioSettings,
  onToggleMuted,
  onToggleDeafened,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveVoiceChannel,
}: {
  accessToken: string
  currentUserId: string
  localParticipantId: string | null
  participants: VoiceParticipant[]
  privateSpace: PrivateSpaceResponse
  localCameraPreviewStream: MediaStream | null
  localScreenPreviewStream: MediaStream | null
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
  friendUserIds: ReadonlySet<string>
  pendingOutgoingUserIds: ReadonlySet<string>
  isMutatingFriends: boolean
  onOpenProfile: (member: PrivateSpaceResponse['members'][number]) => void
  onMentionUser: (participant: VoiceParticipant) => void
  onOpenDirectSpace: (userId: string) => void
  onStartDirectVoice: (user: FriendUserResponse) => void
  onLoadInviteTargetServers: (
    targetUserId: string,
  ) => Promise<ServerMemberResponse[]>
  onCreateDirectServerInvite: (serverId: string, targetUserId: string) => void
  onSendFriendRequest: (userId: string) => void
  onRemoveFriend: (userId: string) => void
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
  const [inviteServersByUserId, setInviteServersByUserId] = useState<
    Record<string, ServerMemberResponse[]>
  >({})
  const [loadingInviteTargetUserIds, setLoadingInviteTargetUserIds] =
    useState<ReadonlySet<string>>(() => new Set())
  const [blockStatusByUserId, setBlockStatusByUserId] = useState<
    Record<string, DirectMessageBlockStatusResponse>
  >({})
  const [mutatingBlockUserId, setMutatingBlockUserId] =
    useState<string | null>(null)
  const [userBlockDialogTarget, setUserBlockDialogTarget] =
    useState<UserBlockDialogTarget | null>(null)
  const mediaTrackVersion = useVoiceMediaTrackVersion({
    localCameraPreviewStream,
    localScreenPreviewStream,
    remoteStreamsByParticipantId,
  })
  const memberByUserId = new Map(
    privateSpace.members.map((member) => [
      normalizePrivateVoiceId(member.userId),
      member,
    ]),
  )

  useEffect(() => {
    setContextMenu(null)
    setUserBlockDialogTarget(null)
  }, [privateSpace.spaceId])

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
    openParticipantMenuAt(
      participant,
      event.clientX,
      event.clientY,
    )
  }

  function openParticipantMenuByKeyboard(
    event: ReactKeyboardEvent<HTMLElement>,
    participant: VoiceParticipant,
  ) {
    if (!isPrivateVoiceContextMenuKey(event.key, event.shiftKey)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    openParticipantMenuAt(
      participant,
      bounds.left + Math.min(bounds.width / 2, 48),
      bounds.top + Math.min(bounds.height / 2, 48),
    )
  }

  function openParticipantMenuAt(
    participant: VoiceParticipant,
    x: number,
    y: number,
  ) {
    setContextMenu({
      participant,
      x,
      y,
    })

    const userId = normalizePrivateVoiceId(participant.userId)
    if (
      !Object.prototype.hasOwnProperty.call(inviteServersByUserId, userId) &&
      !loadingInviteTargetUserIds.has(userId)
    ) {
      setLoadingInviteTargetUserIds((current) => new Set(current).add(userId))
      void onLoadInviteTargetServers(participant.userId)
        .then((memberships) => {
          setInviteServersByUserId((current) => ({
            ...current,
            [userId]: memberships,
          }))
        })
        .catch(() => {
          showPrivateVoiceNotice(communityCopy.direct.inviteTargetsLoadFailed)
        })
        .finally(() => {
          setLoadingInviteTargetUserIds((current) => {
            const next = new Set(current)
            next.delete(userId)
            return next
          })
        })
    }

    if (!Object.prototype.hasOwnProperty.call(blockStatusByUserId, userId)) {
      void loadUserBlockStatus(participant.userId)
    }
  }

  async function loadUserBlockStatus(targetUserId: string) {
    try {
      const status = await apiJson<DirectMessageBlockStatusResponse>(
        `/api/users/me/direct-message-blocks/${encodeURIComponent(targetUserId)}`,
        { accessToken },
      )
      setBlockStatusByUserId((current) => ({
        ...current,
        [normalizePrivateVoiceId(targetUserId)]: status,
      }))
    } catch {
      showPrivateVoiceNotice(communityCopy.direct.blockStatusLoadFailed)
    }
  }

  function requestUserBlockChange(participant: VoiceParticipant) {
    const userId = normalizePrivateVoiceId(participant.userId)
    const status = blockStatusByUserId[userId]
    if (!status || mutatingBlockUserId) return

    if (!status.isBlocked) {
      setUserBlockDialogTarget({
        userId: participant.userId,
        displayName: participant.displayName,
        login: participant.login,
      })
      return
    }

    void unblockUser(participant)
  }

  async function unblockUser(participant: VoiceParticipant) {
    const userId = normalizePrivateVoiceId(participant.userId)
    const status = blockStatusByUserId[userId]
    if (!status?.isBlocked || mutatingBlockUserId) return

    setMutatingBlockUserId(userId)
    try {
      await apiNoContent(
        `/api/users/me/direct-message-blocks/${encodeURIComponent(participant.userId)}`,
        { method: 'DELETE', accessToken },
      )
      setBlockStatusByUserId((current) => ({
        ...current,
        [userId]: {
          ...status,
          isBlocked: false,
          comment: null,
          createdAt: null,
        },
      }))
      dispatchUserBlockChanged({
        userId: participant.userId,
        isBlocked: false,
        comment: null,
      })
      showPrivateVoiceNotice(
        communityCopy.direct.userUnblockedNotice(participant.displayName),
      )
    } catch {
      showPrivateVoiceNotice(communityCopy.direct.unblockFailed)
    } finally {
      setMutatingBlockUserId(null)
    }
  }

  async function blockUser(
    target: UserBlockDialogTarget,
    comment: string | null,
  ) {
    const userId = normalizePrivateVoiceId(target.userId)
    if (mutatingBlockUserId) return

    setMutatingBlockUserId(userId)
    try {
      const blocked = await apiJson<DirectMessageBlockedUserResponse>(
        `/api/users/me/direct-message-blocks/${encodeURIComponent(target.userId)}`,
        {
          method: 'PUT',
          accessToken,
          body: { comment },
        },
      )
      setBlockStatusByUserId((current) => ({
        ...current,
        [userId]: {
          userId: blocked.userId,
          isBlocked: true,
          comment: blocked.comment,
          createdAt: blocked.createdAt,
        },
      }))
      dispatchUserBlockChanged({
        userId: blocked.userId,
        isBlocked: true,
        comment: blocked.comment,
      })
      setUserBlockDialogTarget(null)
      showPrivateVoiceNotice(
        getUserBlockedNotice(target.displayName, blocked.comment),
      )
    } catch {
      showPrivateVoiceNotice(communityCopy.direct.blockFailed)
    } finally {
      setMutatingBlockUserId(null)
    }
  }

  return (
    <section
      className={styles.privateVoiceStrip}
      aria-label={voiceCopy.channel.privateVoiceCall}
    >
      {error && <p className={styles.privateVoiceError}>{error}</p>}

      <div className={styles.privateVoiceParticipants}>
        {participants.flatMap((participant) => {
          const participantId = normalizePrivateVoiceId(participant.participantId)
          const userId = normalizePrivateVoiceId(participant.userId)
          const isSelf =
            participantId === normalizePrivateVoiceId(localParticipantId ?? '') ||
            userId === normalizePrivateVoiceId(currentUserId)
          const remoteStream = isSelf
            ? null
            : remoteStreamsByParticipantId[participantId]
          const remoteTracks = selectParticipantVideoTracks(
            remoteStream,
            participant,
            mediaTrackVersion,
          )
          const cameraStream = isSelf
            ? isCameraEnabled
              ? localCameraPreviewStream
              : null
            : createTrackStream(remoteTracks.camera)
          const screenStream = isSelf
            ? isScreenSharing
              ? localScreenPreviewStream
              : null
            : createTrackStream(remoteTracks.screen)
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

          const cameraCard = (
            <article
              key={`${participant.participantId}-camera`}
              className={`${styles.privateVoiceParticipant} ${
                speakingParticipantIds[participantId] ? styles.speaking : ''
              } ${cameraStream ? styles.withVideo : ''}`}
              tabIndex={isSelf ? undefined : 0}
              onContextMenu={(event) => {
                if (!isSelf) {
                  openParticipantMenu(event, participant)
                }
              }}
              onKeyDown={(event) => {
                if (!isSelf) {
                  openParticipantMenuByKeyboard(event, participant)
                }
              }}
            >
              {cameraStream ? (
                <PrivateVoiceVideo stream={cameraStream} isMuted />
              ) : (
                <PrivateVoiceAvatar
                  displayName={displayName}
                  user={avatarUser}
                  participant={participant}
                />
              )}
              <div>
                <strong className="ui-ellipsis">{displayName}</strong>
                <small className="ui-ellipsis">{status}</small>
              </div>
            </article>
          )

          if (!participant.isScreenSharing && !screenStream) {
            return [cameraCard]
          }

          return [
            cameraCard,
            <article
              key={`${participant.participantId}-screen`}
              className={`${styles.privateVoiceParticipant} ${styles.privateVoiceScreenParticipant} ${
                screenStream ? styles.withVideo : ''
              }`}
              tabIndex={isSelf ? undefined : 0}
              onContextMenu={(event) => {
                if (!isSelf) {
                  openParticipantMenu(event, participant)
                }
              }}
              onKeyDown={(event) => {
                if (!isSelf) {
                  openParticipantMenuByKeyboard(event, participant)
                }
              }}
            >
              {screenStream ? (
                <PrivateVoiceVideo stream={screenStream} isMuted />
              ) : (
                <PrivateVoiceAvatar
                  displayName={displayName}
                  user={avatarUser}
                  participant={participant}
                />
              )}
              <div>
                <strong className="ui-ellipsis">
                  {displayName} · {voiceCopy.channel.screenSuffix}
                </strong>
                <small className="ui-ellipsis">
                  {screenStream
                    ? voiceCopy.channel.screenShare
                    : voiceCopy.channel.screenShareWaiting}
                </small>
              </div>
            </article>,
          ]
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
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildPrivateVoiceParticipantContextMenuItems({
            participant: contextMenu.participant,
            member:
              memberByUserId.get(
                normalizePrivateVoiceId(contextMenu.participant.userId),
              ) ?? null,
            currentUserId,
            spaceKind: privateSpace.kind,
            audioSettings: getAudioSettings(contextMenu.participant.userId),
            friendUserIds,
            pendingOutgoingUserIds,
            inviteServers:
              inviteServersByUserId[
                normalizePrivateVoiceId(contextMenu.participant.userId)
              ] ?? [],
            isLoadingInviteServers:
              loadingInviteTargetUserIds.has(
                normalizePrivateVoiceId(contextMenu.participant.userId),
              ),
            isMutatingFriends,
            isMutatingBlock:
              mutatingBlockUserId ===
              normalizePrivateVoiceId(contextMenu.participant.userId),
            isUserBlockStatusResolved: Object.prototype.hasOwnProperty.call(
              blockStatusByUserId,
              normalizePrivateVoiceId(contextMenu.participant.userId),
            ),
            isUserBlocked:
              blockStatusByUserId[
                normalizePrivateVoiceId(contextMenu.participant.userId)
              ]?.isBlocked === true,
            onOpenProfile,
            onMentionUser,
            onOpenDirectSpace,
            onStartDirectCall: (member) => onStartDirectVoice(member.user),
            onSendFriendRequest,
            onRemoveFriend,
            onCreateDirectInvite: onCreateDirectServerInvite,
            onToggleUserBlock: (participant) => {
              requestUserBlockChange(participant)
            },
            onChangeAudioSettings: (patch) =>
              onChangeAudioSettings(contextMenu.participant.userId, patch),
            onCopyUserId: (userId) => {
              void navigator.clipboard.writeText(userId)
            },
          })}
          onClose={() => setContextMenu(null)}
        />
      )}
      {userBlockDialogTarget && (
        <UserBlockDialog
          target={userBlockDialogTarget}
          isSubmitting={
            mutatingBlockUserId ===
            normalizePrivateVoiceId(userBlockDialogTarget.userId)
          }
          onClose={() => {
            if (!mutatingBlockUserId) {
              setUserBlockDialogTarget(null)
            }
          }}
          onConfirm={(comment) => blockUser(userBlockDialogTarget, comment)}
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
  participant,
}: {
  displayName: string
  user: FriendUserResponse | undefined
  participant: VoiceParticipant
}) {
  const participantAvatar = participant.avatarAssetId
    ? {
        avatarAssetId: participant.avatarAssetId,
        avatarCropOffsetX: participant.avatarCropOffsetX ?? 0,
        avatarCropOffsetY: participant.avatarCropOffsetY ?? 0,
        avatarCropZoom: participant.avatarCropZoom ?? 1,
      }
    : undefined

  return (
    <UserAvatar
      className={styles.privateVoiceAvatar}
      user={user ?? participantAvatar}
      title={displayName}
    />
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

function showPrivateVoiceNotice(body: string) {
  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: {
        id: `private-voice:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        title: communityCopy.direct.noticeTitle,
        body,
        force: true,
      },
    }),
  )
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
  return (
    <UserAvatar
      className={`${styles.privateAvatar} ${large ? styles.largeAvatar : ''}`}
      user={user}
      title={user.displayName}
    />
  )
}
