import type { MouseEvent as ReactMouseEvent } from 'react'
import { voiceCopy } from '../../../../shared/copy/voice.ru.ts'
import type { VoiceParticipant } from '../../../hooks/voice/useVoiceChannel'
import type { VoiceUserAudioSettings } from '../../../../shared/types/voicePlayback'
import { normalizeVoiceUserId } from '../../../../shared/voice/voicePlaybackPreferences'
import type { VoiceParticipantCard } from '../detached/detachedVoiceWorkspaceTypes'
import { VoiceParticipantCardView } from './VoiceParticipantCardView'
import { isVoiceWorkspaceCardVisible } from './voiceWorkspaceViewPreferences'
import styles from './VoiceParticipants.module.css'

type VoiceParticipantsGridProps = {
  participantCards: VoiceParticipantCard[]
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  participantCount: number
  title: string
  joinSummary: string
  isConnected: boolean
  canJoin: boolean
  showParticipantsWithoutVideo: boolean
  showSelfCamera: boolean
  expandedParticipantId: string | null
  avatarAccentsByParticipantId: Record<string, string>
  onExpandedParticipantChange: (participantId: string | null) => void
  onMobileChromeVisibilityChange: (isVisible: boolean) => void
  onToggleMobileChrome: () => void
  onAccentChange: (participantId: string, accent: string) => void
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
  ) => void
  onJoin: () => void
}

export function VoiceParticipantsGrid({
  participantCards,
  audioSettingsByUserId,
  participantCount,
  title,
  joinSummary,
  isConnected,
  canJoin,
  showParticipantsWithoutVideo,
  showSelfCamera,
  expandedParticipantId,
  avatarAccentsByParticipantId,
  onExpandedParticipantChange,
  onMobileChromeVisibilityChange,
  onToggleMobileChrome,
  onAccentChange,
  onOpenContextMenu,
  onJoin,
}: VoiceParticipantsGridProps) {
  const isVideoHidden = (card: VoiceParticipantCard) =>
    audioSettingsByUserId[
      normalizeVoiceUserId(card.participant.userId)
    ]?.isVideoHidden === true
  const selfCameraFilteredCards = participantCards.filter((card) =>
    isVoiceWorkspaceCardVisible(card, showSelfCamera),
  )
  const participantDisplayCards = showParticipantsWithoutVideo
    ? selfCameraFilteredCards
    : selfCameraFilteredCards.filter(
        (card) =>
          card.participant.isCameraEnabled ||
          card.participant.isScreenSharing,
      )
  const availableCards = participantDisplayCards.filter(
    (card) => !isVideoHidden(card) || card.mediaKind === 'camera',
  )
  const visibleCards = isConnected
    ? availableCards
    : availableCards.filter((card) => card.mediaKind === 'camera')
  const expandedCard = visibleCards.find(
    (card) => card.normalizedParticipantId === expandedParticipantId,
  )
  const sideCards = expandedCard
    ? visibleCards.filter(
        (card) =>
          card.normalizedParticipantId !== expandedCard.normalizedParticipantId,
      )
    : visibleCards

  function renderCard(
    card: VoiceParticipantCard,
    variant: 'grid' | 'expanded' | 'side',
  ) {
    return (
      <VoiceParticipantCardView
        key={`${card.participant.participantId}-${card.mediaKind}`}
        card={card}
        isVideoHidden={isVideoHidden(card)}
        audioSettings={
          audioSettingsByUserId[
            normalizeVoiceUserId(card.participant.userId)
          ]
        }
        variant={variant}
        isConnected={isConnected}
        accent={avatarAccentsByParticipantId[card.normalizedParticipantId]}
        onAccentChange={onAccentChange}
        onExpand={(participantId, hideMobileChrome) => {
          onExpandedParticipantChange(participantId)
          if (hideMobileChrome) onMobileChromeVisibilityChange(false)
        }}
        onCollapse={(showMobileChrome) => {
          onExpandedParticipantChange(null)
          if (showMobileChrome) onMobileChromeVisibilityChange(true)
        }}
        onToggleMobileChrome={onToggleMobileChrome}
        onOpenContextMenu={onOpenContextMenu}
      />
    )
  }

  return (
    <div
      className={`${styles.voiceParticipants} ${
        visibleCards.length === 1 && !expandedCard && isConnected
          ? styles.singleVoiceParticipant
          : ''
      } ${
        isConnected &&
        !expandedCard &&
        visibleCards.length > 1 &&
        visibleCards.length <= 3
          ? styles.fewVoiceParticipants
          : ''
      } ${!isConnected ? styles.voiceParticipantsJoinMode : ''} ${
        !isConnected && participantCount === 0
          ? styles.voiceParticipantsEmptyJoinMode
          : ''
      } ${expandedCard ? styles.voiceParticipantsExpanded : ''} ${
        isConnected && !expandedCard && visibleCards.length > 3
          ? styles.manyVoiceParticipants
          : ''
      } ${
        expandedCard && sideCards.length === 0
          ? styles.voiceParticipantsExpandedSolo
          : ''
      } ui-scroll-list ui-scrollbar-none`}
    >
      {expandedCard ? (
        <>
          <div className={styles.voiceParticipantsMain}>
            {renderCard(expandedCard, 'expanded')}
          </div>
          {sideCards.length > 0 && (
            <div className={styles.voiceParticipantsSide}>
              <div className={styles.voiceParticipantsSideGrid}>
                {sideCards.map((card) => renderCard(card, 'side'))}
              </div>
            </div>
          )}
        </>
      ) : (
        visibleCards.map((card) => renderCard(card, 'grid'))
      )}

      {!isConnected && (
        <div className={styles.voiceEmptyState}>
          <strong>{title}</strong>
          <span>
            {!canJoin
              ? voiceCopy.channel.joinRestricted
              : participantCount === 0
                ? voiceCopy.state.noParticipants
                : joinSummary}
          </span>
          <button
            className="ui-action-button"
            type="button"
            disabled={!canJoin}
            title={canJoin ? undefined : voiceCopy.channel.joinRestricted}
            onClick={onJoin}
          >
            {voiceCopy.channel.joinVoiceSpace}
          </button>
        </div>
      )}
    </div>
  )
}
