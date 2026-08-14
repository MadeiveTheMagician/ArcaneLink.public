import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
} from 'react'
import { voiceCopy } from '../../../../shared/copy/voice.ru.ts'
import type { VoiceUserAudioSettings } from '../../../../shared/types/voicePlayback'
import { fallbackAvatarAccent } from '../../../../shared/utils/avatarAccent'
import type { VoiceParticipant } from '../../../hooks/voice/useVoiceChannel'
import type { VoiceParticipantCard } from '../detached/detachedVoiceWorkspaceTypes'
import { VoiceParticipantAvatar } from './VoiceParticipantIdentity'
import { VoiceParticipantLocalStatus } from './VoiceParticipantLocalStatus'
import { VoiceVideoTile } from './VoiceVideoTile'
import workspaceStyles from '../../shell/ServerWorkspace.module.css'
import styles from './VoiceParticipants.module.css'

export type VoiceParticipantCardVariant = 'grid' | 'expanded' | 'side'

type VoiceParticipantCardViewProps = {
  card: VoiceParticipantCard
  variant: VoiceParticipantCardVariant
  isConnected: boolean
  isVideoHidden: boolean
  audioSettings?: VoiceUserAudioSettings
  accent: string | undefined
  onAccentChange: (participantId: string, accent: string) => void
  onExpand: (participantId: string, hideMobileChrome: boolean) => void
  onCollapse: (showMobileChrome: boolean) => void
  onToggleMobileChrome: () => void
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
  ) => void
}

const mobileVoiceWorkspaceQuery = '(max-width: 760px)'

export function VoiceParticipantCardView({
  card,
  variant,
  isConnected,
  isVideoHidden,
  audioSettings,
  accent,
  onAccentChange,
  onExpand,
  onCollapse,
  onToggleMobileChrome,
  onOpenContextMenu,
}: VoiceParticipantCardViewProps) {
  const {
    hasVideo,
    isSelf,
    isSpeaking,
    normalizedParticipantId,
    participant,
    participantMember,
    participantStream,
  } = card
  const isMobile = isMobileVoiceWorkspace()
  const showsVideo = hasVideo && !isVideoHidden
  const canExpandCard = isConnected && (!isMobile || showsVideo)
  const voiceCardStyle = {
    '--voice-card-accent': accent ?? fallbackAvatarAccent,
  } as CSSProperties

  return (
    <article
      className={`${isSelf ? styles.participantSelf : ''} ${
        isSpeaking && card.mediaKind === 'camera'
          ? styles.participantSpeaking
          : ''
      } ${showsVideo ? styles.participantWithVideo : ''} ${
        card.mediaKind === 'screen' ? styles.voiceParticipantScreenTile : ''
      } ${
        card.mediaKind === 'camera' ? styles.voiceParticipantCameraTile : ''
      } ${
        variant === 'expanded' ? styles.voiceParticipantExpandedTile : ''
      } ${variant === 'side' ? styles.voiceParticipantSideTile : ''} ${
        canExpandCard && variant !== 'expanded'
          ? styles.voiceParticipantExpandable
          : ''
      }`}
      style={voiceCardStyle}
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation()

        if (!canExpandCard) return

        if (variant === 'expanded') {
          if (isMobile) {
            onToggleMobileChrome()
            return
          }

          onCollapse(false)
          return
        }

        onExpand(normalizedParticipantId, isMobile && showsVideo)
      }}
      onContextMenu={(event) => {
        onOpenContextMenu(event, participant)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) {
          return
        }

        event.preventDefault()
        const bounds = event.currentTarget.getBoundingClientRect()
        event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: bounds.left + 18,
          clientY: bounds.top + 18,
        }))
      }}
    >
      {participantStream && showsVideo ? (
        <>
          <VoiceVideoTile stream={participantStream} isMuted />
          {variant !== 'expanded' && (
            <button
              className={styles.voiceParticipantFocusButton}
              type="button"
              aria-label={voiceCopy.channel.expandStream}
              onClick={(event) => {
                event.stopPropagation()
                onExpand(normalizedParticipantId, true)
              }}
            >
              <span aria-hidden="true" />
            </button>
          )}
          {variant === 'expanded' && (
            <button
              className={`${styles.voiceParticipantFocusButton} ${styles.voiceParticipantFocusExitButton}`}
              type="button"
              aria-label={voiceCopy.channel.shrinkStream}
              onClick={(event) => {
                event.stopPropagation()
                onCollapse(true)
              }}
            >
              <span aria-hidden="true" />
            </button>
          )}
        </>
      ) : (
        <VoiceParticipantAvatar
          participant={participant}
          member={participantMember}
          className={`${workspaceStyles.memberAvatar} ${styles.voiceMemberAvatar}`}
          onAccentChange={(nextAccent) =>
            onAccentChange(normalizedParticipantId, nextAccent)
          }
        />
      )}
      <div className={styles.voiceParticipantIdentityLine}>
        <strong className="ui-ellipsis">
          {card.mediaKind === 'screen'
            ? `${participant.displayName} · ${voiceCopy.channel.screenSuffix}`
            : participant.displayName}
        </strong>
        <VoiceParticipantLocalStatus
          participant={participant}
          settings={audioSettings}
          className={styles.voiceParticipantCardStatuses}
        />
      </div>
    </article>
  )
}

function isMobileVoiceWorkspace() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(mobileVoiceWorkspaceQuery).matches
  )
}
