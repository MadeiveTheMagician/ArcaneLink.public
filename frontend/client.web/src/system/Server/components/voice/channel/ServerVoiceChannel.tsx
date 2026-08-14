import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { ServerMemberDetailsResponse } from '../../../../../shared/types'
import type {
  VoicePlaybackState,
  VoiceUserAudioSettings,
} from '../../../../shared/types/voicePlayback'
import { SystemIcon, voiceCopy } from '../../../../shared/index'
import type {
  VoiceParticipant,
  VoicePeerStatus,
} from '../../../hooks/voice/useVoiceChannel'
import type { VoiceParticipantCard } from '../detached/detachedVoiceWorkspaceTypes'
import { normalizeVoiceParticipantUserId as normalizeUserId } from '../participants/VoiceParticipantIdentity'
import { VoiceParticipantsGrid } from '../participants/VoiceParticipantsGrid'
import {
  loadVoiceWorkspaceViewPreferences,
  saveVoiceWorkspaceViewPreferences,
  type VoiceWorkspaceViewPreferences,
} from '../participants/voiceWorkspaceViewPreferences'
import {
  createEffectiveVoiceParticipants,
  createVoiceParticipantCards,
} from '../participants/voiceParticipantCards'
import { useDetachedVoiceWorkspace } from '../detached/useDetachedVoiceWorkspace'
import { useVoiceMediaTrackVersion } from '../participants/useVoiceMediaTrackVersion'
import { VoiceWorkspaceControls } from '../controls/VoiceWorkspaceControls'
import {
  VoiceSpaceChatPanel,
  type VoiceSpaceChatContentProps,
} from '../chat/VoiceSpaceChatPanel'
import styles from './ServerVoiceChannel.module.css'

const DEFAULT_VOICE_CHAT_WIDTH = 430
const MIN_VOICE_CHAT_WIDTH = 280
const MAX_VOICE_CHAT_WIDTH = 640
const VOICE_CHAT_WIDTH_STEP = 24

type ServerVoiceChannelProps = {
  accessToken: string
  workspaceKey: string
  currentUserId: string
  localParticipantId: string | null
  leadingAction?: ReactNode
  title: string
  isVoiceChatOpen: boolean
  headerActions?: ReactNode
  voiceChat: VoiceSpaceChatContentProps
  participants: VoiceParticipant[]
  serverMembers: ServerMemberDetailsResponse[]
  localCameraPreviewStream: MediaStream | null
  localScreenPreviewStream: MediaStream | null
  remoteStreamsByParticipantId: Record<string, MediaStream>
  peerStatusesByParticipantId: Record<string, VoicePeerStatus>
  speakingParticipantIds: Record<string, boolean>
  error: string | null
  isMuted: boolean
  isDeafened: boolean
  isConnectedToVoiceChannel: boolean
  canConnectVoice: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  playbackStatesByParticipantId: Record<string, VoicePlaybackState>
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  onOpenParticipantContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
    workspaceActions?: {
      onOpenDetachedParticipant?: () => void
      showParticipantsWithoutVideo?: boolean
      onToggleParticipantsWithoutVideo?: () => void
    },
  ) => void
  onToggleMuted: () => void
  onToggleDeafened: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeaveVoiceChannel: () => void
  onJoinVoiceChannel: () => void
  onOpenSettings: () => void
  onToggleVoiceChat: () => void
}

export function ServerVoiceChannel({
  accessToken,
  workspaceKey,
  currentUserId,
  localParticipantId,
  leadingAction,
  title,
  isVoiceChatOpen,
  headerActions,
  voiceChat,
  participants,
  serverMembers,
  localCameraPreviewStream,
  localScreenPreviewStream,
  remoteStreamsByParticipantId,
  peerStatusesByParticipantId,
  speakingParticipantIds,
  error,
  isMuted,
  isDeafened,
  isConnectedToVoiceChannel,
  canConnectVoice,
  isCameraEnabled,
  isScreenSharing,
  playbackStatesByParticipantId,
  audioSettingsByUserId,
  onOpenParticipantContextMenu,
  onToggleMuted,
  onToggleDeafened,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveVoiceChannel,
  onJoinVoiceChannel,
  onOpenSettings,
  onToggleVoiceChat,
}: ServerVoiceChannelProps) {
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(
    null,
  )
  const [isMobileVoiceChromeVisible, setIsMobileVoiceChromeVisible] =
    useState(true)
  const [voiceChatWidth, setVoiceChatWidth] = useState(
    DEFAULT_VOICE_CHAT_WIDTH,
  )
  const voiceWorkspaceContentRef = useRef<HTMLDivElement | null>(null)
  const voiceChatResizeStateRef = useRef<{
    pointerId: number
    containerRight: number
  } | null>(null)
  const [viewPreferences, setViewPreferences] = useState(() =>
    loadVoiceWorkspaceViewPreferences(currentUserId),
  )
  const { showParticipantsWithoutVideo, showSelfCamera } = viewPreferences
  const mediaTrackVersion = useVoiceMediaTrackVersion({
    localCameraPreviewStream,
    localScreenPreviewStream,
    remoteStreamsByParticipantId,
  })
  const [avatarAccentsByParticipantId, setAvatarAccentsByParticipantId] =
    useState<Record<string, string>>({})

  useEffect(() => {
    setViewPreferences(loadVoiceWorkspaceViewPreferences(currentUserId))
  }, [currentUserId])

  function updateViewPreferences(
    patch: Partial<VoiceWorkspaceViewPreferences>,
  ) {
    setViewPreferences((current) => {
      const next = { ...current, ...patch }
      saveVoiceWorkspaceViewPreferences(currentUserId, next)
      return next
    })
  }
  const effectiveParticipants = useMemo(() => createEffectiveVoiceParticipants({
    participants,
    serverMembers,
    isConnected: isConnectedToVoiceChannel,
    currentUserId,
    isCameraEnabled,
    isDeafened,
    isMuted,
    isScreenSharing,
    localParticipantId,
  }), [
    currentUserId,
    isCameraEnabled,
    isConnectedToVoiceChannel,
    isDeafened,
    isMuted,
    isScreenSharing,
    localParticipantId,
    participants,
    serverMembers,
  ])
  const participantCards: VoiceParticipantCard[] = useMemo(
    () => createVoiceParticipantCards({
      participants: effectiveParticipants,
      serverMembers,
      currentUserId,
      localParticipantId,
      localCameraPreviewStream,
      localScreenPreviewStream,
      remoteStreamsByParticipantId,
      peerStatusesByParticipantId,
      playbackStatesByParticipantId,
      speakingParticipantIds,
      avatarAccentsByParticipantId,
      mediaTrackVersion,
    }),
  [
    avatarAccentsByParticipantId,
    currentUserId,
    localCameraPreviewStream,
    localParticipantId,
    localScreenPreviewStream,
    mediaTrackVersion,
    effectiveParticipants,
    peerStatusesByParticipantId,
    playbackStatesByParticipantId,
    remoteStreamsByParticipantId,
    serverMembers,
    speakingParticipantIds,
  ])
  const joinStateParticipantSummary = useMemo(
    () => createVoiceParticipantSummary(participants),
    [participants],
  )
  const detachedActions = useMemo(
    () => ({
      onToggleMuted,
      onToggleDeafened,
      onToggleCamera,
      onToggleScreenShare,
      onLeaveVoiceChannel,
      onOpenSettings,
    }),
    [
      onLeaveVoiceChannel,
      onOpenSettings,
      onToggleCamera,
      onToggleDeafened,
      onToggleMuted,
      onToggleScreenShare,
    ],
  )
  const {
    surfaceRef: voiceSurfaceRef,
    isFullscreen: isWorkspaceFullscreen,
    openDetachedParticipant,
    openDetachedWorkspace,
    detachedVoiceChatHost,
    isDetachedVoiceChatOpen,
    closeDetachedVoiceChat,
    toggleFullscreen: toggleWorkspaceFullscreen,
  } = useDetachedVoiceWorkspace({
    accessToken,
    workspaceKey,
    title,
    participantCards,
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
    actions: detachedActions,
  })
  function setParticipantAvatarAccent(participantId: string, accent: string) {
    const normalizedParticipantId = normalizeUserId(participantId)

    setAvatarAccentsByParticipantId((current) => {
      if (current[normalizedParticipantId] === accent) {
        return current
      }

      return {
        ...current,
        [normalizedParticipantId]: accent,
      }
    })
  }

  function getVoiceChatWidthBounds() {
    const containerWidth =
      voiceWorkspaceContentRef.current?.getBoundingClientRect().width ??
      MAX_VOICE_CHAT_WIDTH / 0.68
    const max = Math.max(
      MIN_VOICE_CHAT_WIDTH,
      Math.min(MAX_VOICE_CHAT_WIDTH, containerWidth * 0.68),
    )

    return {
      min: Math.min(MIN_VOICE_CHAT_WIDTH, max),
      max,
    }
  }

  function clampVoiceChatWidth(width: number) {
    const bounds = getVoiceChatWidthBounds()
    return Math.min(bounds.max, Math.max(bounds.min, width))
  }

  function startVoiceChatResize(event: ReactPointerEvent<HTMLDivElement>) {
    const container = voiceWorkspaceContentRef.current
    if (!container) return

    voiceChatResizeStateRef.current = {
      pointerId: event.pointerId,
      containerRight: container.getBoundingClientRect().right,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function resizeVoiceChat(event: ReactPointerEvent<HTMLDivElement>) {
    const state = voiceChatResizeStateRef.current
    if (!state || state.pointerId !== event.pointerId) return

    setVoiceChatWidth(
      clampVoiceChatWidth(state.containerRight - event.clientX),
    )
  }

  function finishVoiceChatResize(event: ReactPointerEvent<HTMLDivElement>) {
    const state = voiceChatResizeStateRef.current
    if (!state || state.pointerId !== event.pointerId) return

    voiceChatResizeStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleVoiceChatResizeKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    setVoiceChatWidth((current) =>
      clampVoiceChatWidth(
        current +
          (event.key === 'ArrowLeft'
            ? VOICE_CHAT_WIDTH_STEP
            : -VOICE_CHAT_WIDTH_STEP),
      ),
    )
  }

  return (
    <section
      ref={voiceSurfaceRef}
      className={styles.voiceSurface}
      data-voice-workspace="true"
      data-voice-controls-present={isConnectedToVoiceChannel ? 'true' : 'false'}
      data-voice-expanded={expandedParticipantId ? 'true' : 'false'}
      data-webcam-focus={isWorkspaceFullscreen ? 'true' : 'false'}
      data-mobile-chrome-visible={isMobileVoiceChromeVisible ? 'true' : 'false'}
      data-voice-chat-open={isVoiceChatOpen ? 'true' : 'false'}
      onClick={() => {
        if (!isConnectedToVoiceChannel) {
          return
        }

        setIsMobileVoiceChromeVisible((isVisible) => !isVisible)
      }}
    >
      <header onClick={(event) => event.stopPropagation()}>
        {leadingAction}
        <div>
          <span>
            <VolumeIcon />
          </span>
          <strong>{title}</strong>
        </div>
        <button
          className={styles.voiceChatToggle}
          type="button"
          aria-label={
            isVoiceChatOpen
              ? voiceCopy.channel.closeChat
              : voiceCopy.channel.openChat
          }
          title={
            isVoiceChatOpen
              ? voiceCopy.channel.closeChat
              : voiceCopy.channel.openChat
          }
          aria-pressed={isVoiceChatOpen}
          onClick={onToggleVoiceChat}
        >
          <SystemIcon name="message" size={18} />
        </button>
        {headerActions}
      </header>

      <div
        ref={voiceWorkspaceContentRef}
        className={styles.voiceWorkspaceContent}
        style={
          {
            '--voice-chat-width': `${voiceChatWidth}px`,
          } as CSSProperties
        }
      >
        <div className={styles.voiceStage}>
          <div className={styles.voiceBody}>
            {error && (
              <div className={styles.voiceStatus}>
                <small>{error}</small>
              </div>
            )}

            <VoiceParticipantsGrid
              participantCards={participantCards}
              audioSettingsByUserId={audioSettingsByUserId}
              participantCount={participants.length}
              title={title}
              joinSummary={joinStateParticipantSummary}
              isConnected={isConnectedToVoiceChannel}
              canJoin={canConnectVoice}
              showParticipantsWithoutVideo={showParticipantsWithoutVideo}
              showSelfCamera={showSelfCamera}
              expandedParticipantId={expandedParticipantId}
              avatarAccentsByParticipantId={avatarAccentsByParticipantId}
              onExpandedParticipantChange={setExpandedParticipantId}
              onMobileChromeVisibilityChange={setIsMobileVoiceChromeVisible}
              onToggleMobileChrome={() =>
                setIsMobileVoiceChromeVisible((isVisible) => !isVisible)
              }
              onAccentChange={setParticipantAvatarAccent}
              onOpenContextMenu={(event, participant) =>
                onOpenParticipantContextMenu(event, participant, {
                  onOpenDetachedParticipant: () =>
                    openDetachedParticipant(participant.userId),
                  showParticipantsWithoutVideo,
                  onToggleParticipantsWithoutVideo: () =>
                    updateViewPreferences({
                      showParticipantsWithoutVideo: !showParticipantsWithoutVideo,
                    }),
                })
              }
              onJoin={onJoinVoiceChannel}
            />
          </div>

          <VoiceWorkspaceControls
            isConnected={isConnectedToVoiceChannel}
            hasParticipantCards={participantCards.length > 0}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isCameraEnabled={isCameraEnabled}
            isScreenSharing={isScreenSharing}
            isWorkspaceFullscreen={isWorkspaceFullscreen}
            showParticipantsWithoutVideo={showParticipantsWithoutVideo}
            showSelfCamera={showSelfCamera}
            onToggleMuted={onToggleMuted}
            onToggleDeafened={onToggleDeafened}
            onToggleCamera={onToggleCamera}
            onToggleScreenShare={onToggleScreenShare}
            onLeaveVoiceChannel={onLeaveVoiceChannel}
            onOpenDetachedWorkspace={openDetachedWorkspace}
            onToggleParticipantsWithoutVideo={() =>
              updateViewPreferences({
                showParticipantsWithoutVideo: !showParticipantsWithoutVideo,
              })
            }
            onToggleSelfCamera={() =>
              updateViewPreferences({ showSelfCamera: !showSelfCamera })
            }
            onToggleWorkspaceFullscreen={() => void toggleWorkspaceFullscreen()}
          />
        </div>

        <aside
          className={styles.voiceChatDock}
          aria-hidden={!isVoiceChatOpen}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={styles.voiceChatResizeHandle}
            role="separator"
            aria-label="Изменить ширину чата голосового спейса"
            aria-orientation="vertical"
            aria-valuemin={MIN_VOICE_CHAT_WIDTH}
            aria-valuemax={MAX_VOICE_CHAT_WIDTH}
            aria-valuenow={Math.round(voiceChatWidth)}
            data-tooltip="Перетащите границу, чтобы изменить ширину чата"
            tabIndex={isVoiceChatOpen ? 0 : -1}
            onPointerDown={startVoiceChatResize}
            onPointerMove={resizeVoiceChat}
            onPointerUp={finishVoiceChatResize}
            onPointerCancel={finishVoiceChatResize}
            onKeyDown={handleVoiceChatResizeKeyDown}
          />
          {isVoiceChatOpen && (
            <VoiceSpaceChatPanel
              key={`${voiceChat.feedKey}:workspace`}
              {...voiceChat}
              placement="workspace"
              onClose={onToggleVoiceChat}
            />
          )}
        </aside>
      </div>

      {detachedVoiceChatHost && isDetachedVoiceChatOpen
        ? createPortal(
            <VoiceSpaceChatPanel
              key={`${voiceChat.feedKey}:detached`}
              {...voiceChat}
              placement="detached"
              onClose={closeDetachedVoiceChat}
            />,
            detachedVoiceChatHost,
          )
        : null}

    </section>
  )
}

function createVoiceParticipantSummary(participants: VoiceParticipant[]) {
  const names = participants
    .map((participant) => participant.displayName.trim())
    .filter(Boolean)

  if (names.length === 0) {
    return voiceCopy.state.noParticipants
  }

  const visibleNames = names
    .slice(0, 2)
    .map((name) => `"${name}"`)
    .join('\n')
  const hiddenCount = names.length - 2

  const summary = hiddenCount > 0
    ? voiceCopy.state.participantSummaryMore(visibleNames, hiddenCount)
    : visibleNames

  return voiceCopy.state.participantSummary(summary)
}

function VolumeIcon() {
  return (
    <SystemIcon className={styles.voiceSpaceIcon} name="speaker" size={20} />
  )
}
