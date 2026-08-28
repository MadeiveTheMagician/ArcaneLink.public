import { useEffect, useState } from 'react'
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
} from 'react'
import type {
  ReorderSpacesRequest,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  SpaceResponse,
} from '../../../../shared/types'
import type { ServerMemberProfileAnchor } from '../member-profile/serverMemberProfileModel'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import type { VoiceUserAudioSettings } from '../../../shared/types/voicePlayback'
import { serverCopy, SystemIcon } from '../../../shared'
import type { ServerDetail } from '../../utils/serverWorkspaceModel'
import headerStyles from './ServerChannelTreeHeader.module.css'
import { MobileServerMembersPanel } from './MobileServerMembersPanel'
import {
  isMobileMembersPanelOpen,
  type MobileServerTab,
} from './mobileServerMembersPanelModel'
import styles from './ServerChannelTreeNavigation.module.css'
import reorderStyles from './ServerChannelTreeReorder.module.css'
import { SpaceNavigationNode } from './SpaceNavigationNode'
import { ServerChannelTreeSkeleton } from './ServerChannelTreeSkeleton'
import { useSpaceTreeDragAndDrop } from './useSpaceTreeDragAndDrop'

const MOBILE_SERVER_TREE_QUERY = '(max-width: 760px)'

type ServerChannelTreeProps = {
  server: ServerMemberResponse['server']
  rootSpaces: SpaceResponse[]
  spaces: SpaceResponse[]
  visibleDetail: ServerDetail | null
  selectedMemberId: string | null
  isLoadingSpaces: boolean
  canInviteMembers: boolean
  canOpenServerSettings: boolean
  canManageSpaces: boolean
  canManageServer: boolean
  canMoveVoiceParticipants: boolean
  participantsBySpaceId: Record<string, VoiceParticipant[]>
  audioSettingsByUserId: Record<string, VoiceUserAudioSettings>
  serverMembers: ServerMemberDetailsResponse[]
  serverMemberCount: number
  isLoadingMoreMembers: boolean
  hasMoreMembers: boolean
  speakingParticipantIds: Record<string, boolean>
  openVoiceChatSpaceId: string | null
  collapsedCategoryIds: Set<string>
  onOpenInviteDialog: () => void
  onOpenSettings: () => void
  onSelectOverview: () => void
  onSelectMember: (
    member: ServerMemberDetailsResponse,
    anchor: ServerMemberProfileAnchor,
    focusTarget: HTMLElement,
  ) => void
  onLoadMoreMembers: () => Promise<boolean>
  onSelectSpace: (space: SpaceResponse) => void
  onOpenVoiceChat: (space: SpaceResponse) => void
  onToggleCategory: (spaceId: string) => void
  onReorderSpaces: (request: ReorderSpacesRequest) => Promise<boolean>
  onMoveVoiceParticipant: (
    sourceSpaceId: string,
    targetSpaceId: string,
    participantId: string,
  ) => Promise<void>
  onOpenVoiceParticipantContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    participant: VoiceParticipant,
    sourceSpaceId: string,
  ) => void
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    space?: SpaceResponse | null,
  ) => void
}

export function ServerChannelTree({
  server,
  rootSpaces,
  spaces,
  visibleDetail,
  selectedMemberId,
  isLoadingSpaces,
  canInviteMembers,
  canOpenServerSettings,
  canManageSpaces,
  canManageServer,
  canMoveVoiceParticipants,
  participantsBySpaceId,
  audioSettingsByUserId,
  serverMembers,
  serverMemberCount,
  isLoadingMoreMembers,
  hasMoreMembers,
  speakingParticipantIds,
  openVoiceChatSpaceId,
  collapsedCategoryIds,
  onOpenInviteDialog,
  onOpenSettings,
  onSelectOverview,
  onSelectMember,
  onLoadMoreMembers,
  onSelectSpace,
  onOpenVoiceChat,
  onToggleCategory,
  onReorderSpaces,
  onMoveVoiceParticipant,
  onOpenVoiceParticipantContextMenu,
  onContextMenu,
}: ServerChannelTreeProps) {
  const [mobileServerTab, setMobileServerTab] =
    useState<MobileServerTab>('spaces')
  const [isMobileSpaceReorderEnabled, setIsMobileSpaceReorderEnabled] =
    useState(false)
  const isMobileServerTree = useMobileServerTree()
  const isMobileMembersOpen = isMobileMembersPanelOpen(
    isMobileServerTree,
    mobileServerTab,
  )
  const canDragSpaces =
    canManageSpaces && (!isMobileServerTree || isMobileSpaceReorderEnabled)
  const dragAndDrop = useSpaceTreeDragAndDrop({
    spaces,
    canDragSpaces,
    canManageServer,
    canMoveVoiceParticipants,
    onReorderSpaces,
    onMoveVoiceParticipant,
    setSpaceDragImage,
    setVoiceParticipantDragImage,
  })
  const {
    clearRootSpaceDropTarget,
    clearSpaceDragState,
    clearVoiceDragState,
    draggedSpaceId,
    draggedVoiceParticipant,
    dropSpaceOnRoot,
    dropSpaceOnTarget,
    dropVoiceParticipantOnTarget,
    isRootSpaceDropTarget,
    spaceDropTarget,
    startSpaceDrag,
    startVoiceParticipantDrag,
    updateRootSpaceDropTarget,
    updateSpaceDropTarget,
    updateVoiceParticipantDropTarget,
    voiceDropTargetSpaceId,
  } = dragAndDrop

  function toggleMobileSpaceReorder() {
    clearSpaceDragState()
    setMobileServerTab('spaces')
    setIsMobileSpaceReorderEnabled((value) => !value)
  }

  function selectSpaceAfterPotentialDrag(space: SpaceResponse) {
    if (dragAndDrop.consumeSuppressedSpaceClick(space.id)) {
      return
    }

    setMobileServerTab('spaces')
    onSelectSpace(space)
  }

  return (
    <aside className={`${styles.spacePanel} ui-panel`} aria-label="Server spaces">
      <header className={headerStyles.spaceTitle}>
        <div className={headerStyles.topbarTitle}>
          <span className={headerStyles.topbarIcon}>
            {server.iconAssetId ? (
              <img
                className="ui-media-fit"
                src={`/api/assets/${server.iconAssetId}/content`}
                alt=""
                style={{
                  transform: `translate(${server.iconCropOffsetX * 100}%, ${
                    server.iconCropOffsetY * 100
                  }%) scale(${server.iconCropZoom})`,
                }}
              />
            ) : (
              server.title.slice(0, 1).toUpperCase()
            )}
          </span>
          <strong>{server.title}</strong>
          <div className={headerStyles.topbarActions}>
            {canInviteMembers && (
              <button
                className={headerStyles.inviteButton}
                type="button"
                onClick={onOpenInviteDialog}
                aria-label={serverCopy.actions.inviteMembers}
                title={serverCopy.actions.inviteMembers}
              >
                <SystemIcon name="plus" size={20} />
              </button>
            )}
            {canManageSpaces && (
              <button
                className={[
                  headerStyles.mobileReorderButton,
                  isMobileSpaceReorderEnabled
                    ? headerStyles.mobileReorderButtonActive
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                aria-label={serverCopy.labels.sortSpacesMode}
                aria-pressed={isMobileSpaceReorderEnabled}
                title={serverCopy.labels.sortSpacesMode}
                onClick={toggleMobileSpaceReorder}
              >
                <SystemIcon name="more-vertical" size={20} />
              </button>
            )}
            {canOpenServerSettings && (
              <button
                className={headerStyles.settingsButton}
                type="button"
                onClick={onOpenSettings}
                aria-label={serverCopy.settings.title}
                title={serverCopy.settings.title}
              >
                <SystemIcon name="settings" size={20} />
              </button>
            )}
          </div>
        </div>
        <span>Spaces</span>
        <div
          className={headerStyles.mobileServerTabs}
          aria-label={serverCopy.labels.sections}
        >
          <button
            className={
              visibleDetail?.type === 'overview'
                ? headerStyles.mobileServerTabActive
                : ''
            }
            type="button"
            onClick={() => {
              setMobileServerTab('spaces')
              onSelectOverview()
            }}
          >
            {serverCopy.labels.overview}
          </button>
          <button
            className={
              mobileServerTab === 'spaces' &&
              (visibleDetail?.type === 'channel' || visibleDetail === null)
                ? headerStyles.mobileServerTabActive
                : ''
            }
            type="button"
            onClick={() => setMobileServerTab('spaces')}
          >
            {serverCopy.labels.spaces}
          </button>
          <button
            className={
              isMobileMembersOpen
                ? headerStyles.mobileServerTabActive
                : ''
            }
            type="button"
            aria-controls="mobile-server-members-panel"
            aria-pressed={isMobileMembersOpen}
            onClick={() => setMobileServerTab('members')}
          >
            {serverCopy.labels.members}
          </button>
        </div>
      </header>
      <nav
        className={[
          'ui-scroll-list ui-scrollbar-none',
          isRootSpaceDropTarget ? reorderStyles.spaceRootDropTarget : '',
          isMobileMembersOpen ? styles.mobileSpacesPanelHidden : '',
          isMobileSpaceReorderEnabled ? styles.mobileSpacesReorderEnabled : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={updateRootSpaceDropTarget}
        onDragLeave={clearRootSpaceDropTarget}
        onDrop={(event) => void dropSpaceOnRoot(event)}
        onContextMenu={(event) => onContextMenu(event)}
        aria-busy={isLoadingSpaces}
        aria-hidden={isMobileMembersOpen}
        inert={isMobileMembersOpen}
      >
        <button
          className={visibleDetail?.type === 'overview' ? styles.active : ''}
          type="button"
          onClick={onSelectOverview}
        >
          <span>#</span>
          <strong>{serverCopy.labels.overview}</strong>
        </button>
        {isLoadingSpaces ? (
          <ServerChannelTreeSkeleton />
        ) : (
          <>
            {rootSpaces.length === 0 && <p>{serverCopy.state.emptySpaces}</p>}
            {rootSpaces.map((space) => (
              <SpaceNavigationNode
                key={space.id}
                depth={0}
                space={space}
                spaces={spaces}
                visibleDetail={visibleDetail}
                participantsBySpaceId={participantsBySpaceId}
                audioSettingsByUserId={audioSettingsByUserId}
                serverMembers={serverMembers}
                serverMemberCount={serverMemberCount}
                speakingParticipantIds={speakingParticipantIds}
                openVoiceChatSpaceId={openVoiceChatSpaceId}
                collapsedCategoryIds={collapsedCategoryIds}
                canDragSpaces={canDragSpaces}
                canMoveVoiceParticipants={canMoveVoiceParticipants}
                draggedSpaceId={draggedSpaceId}
                spaceDropTarget={spaceDropTarget}
                voiceDropTargetSpaceId={voiceDropTargetSpaceId}
                draggedVoiceParticipant={draggedVoiceParticipant}
                onSelect={selectSpaceAfterPotentialDrag}
                onOpenVoiceChat={onOpenVoiceChat}
                onToggleCategory={onToggleCategory}
                onStartSpaceDrag={startSpaceDrag}
                onUpdateSpaceDropTarget={updateSpaceDropTarget}
                onDropSpaceOnTarget={dropSpaceOnTarget}
                onClearSpaceDragState={clearSpaceDragState}
                onStartVoiceParticipantDrag={startVoiceParticipantDrag}
                onUpdateVoiceParticipantDropTarget={updateVoiceParticipantDropTarget}
                onDropVoiceParticipantOnTarget={dropVoiceParticipantOnTarget}
                onClearVoiceDragState={clearVoiceDragState}
                onOpenVoiceParticipantContextMenu={
                  onOpenVoiceParticipantContextMenu
                }
                onContextMenu={onContextMenu}
              />
            ))}
          </>
        )}
      </nav>
      <MobileServerMembersPanel
        members={serverMembers}
        selectedMemberId={selectedMemberId}
        isOpen={isMobileMembersOpen}
        isLoadingMore={isLoadingMoreMembers}
        hasMore={hasMoreMembers}
        onSelectMember={onSelectMember}
        onLoadMore={onLoadMoreMembers}
      />
    </aside>
  )
}

function useMobileServerTree() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_SERVER_TREE_QUERY)

    setIsMobile(mediaQuery.matches)

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return isMobile
}

function setSpaceDragImage(event: ReactDragEvent<HTMLElement>) {
  const sourceElement = event.currentTarget
  const dragImage =
    sourceElement.closest('button') ??
    sourceElement.closest(`.${styles.spaceLeaf}`) ??
    sourceElement.closest(`.${styles.spaceCategory}`)

  if (dragImage instanceof HTMLElement) {
    const rect = dragImage.getBoundingClientRect()
    event.dataTransfer.setDragImage(
      dragImage,
      Math.min(32, rect.width / 2),
      Math.min(18, rect.height / 2),
    )
  }
}

function setVoiceParticipantDragImage(event: ReactDragEvent<HTMLElement>) {
  const dragImage = event.currentTarget

  if (dragImage instanceof HTMLElement) {
    const rect = dragImage.getBoundingClientRect()
    event.dataTransfer.setDragImage(
      dragImage,
      Math.min(28, rect.width / 2),
      Math.min(16, rect.height / 2),
    )
  }
}
