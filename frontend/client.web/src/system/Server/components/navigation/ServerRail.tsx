import {
  closestCenter,
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type {
  ServerMemberDetailsResponse,
  ServerMemberResponse,
} from '../../../../shared/types'
import {
  commonCopy,
  communityCopy,
  serverCopy,
  SystemIcon,
  UnreadBadge,
} from '../../../shared/index'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import { getUnreadMessageLabel } from '../../../shared/ui/unreadBadgeModel'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import { ServerTooltip } from './ServerTooltip'
import styles from './ServerRail.module.css'

const serverRailSkeletonKeys = Array.from(
  { length: 16 },
  (_, index) => `server-${index + 1}`,
)

type ServerRailProps = {
  avatarSrc: string
  isOpen: boolean
  isLoadingServers: boolean
  memberships: ServerMemberResponse[]
  selectedServerId?: string
  selectedServerMembers: ServerMemberDetailsResponse[]
  selectedServerVoiceParticipants: VoiceParticipant[]
  onOpenProfile: () => void
  onOpenServer: (membership: ServerMemberResponse) => void
  onOpenContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse,
  ) => void
  onReorderServers: (activeServerId: string, overServerId: string) => void
  onCreateServer: () => void
  onShowAllServers: () => void
  onShowFriends: () => void
  onShowInvites: () => void
}

type ServerDropPlacement = 'before' | 'after'

type ServerDropIndicator = {
  serverId: string
  placement: ServerDropPlacement
}

export function ServerRail({
  avatarSrc,
  isOpen,
  isLoadingServers,
  memberships,
  selectedServerId,
  selectedServerMembers,
  selectedServerVoiceParticipants,
  onOpenProfile,
  onOpenServer,
  onOpenContextMenu,
  onReorderServers,
  onCreateServer,
  onShowAllServers,
  onShowFriends,
  onShowInvites,
}: ServerRailProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )
  const [dropIndicator, setDropIndicator] =
    useState<ServerDropIndicator | null>(null)

  function handleServerDragStart(event: DragStartEvent) {
    const activeServerId = String(event.active.id)

    if (memberships.some((membership) => membership.serverId === activeServerId)) {
      document.body.classList.add('is-server-rail-dragging')
      setDropIndicator(null)
    }
  }

  function handleServerDragOver(event: DragOverEvent) {
    const activeServerId = String(event.active.id)
    const overServerId = event.over ? String(event.over.id) : null
    const nextIndicator = getServerDropIndicator(
      memberships,
      activeServerId,
      overServerId,
    )

    setDropIndicator((current) =>
      current?.serverId === nextIndicator?.serverId &&
      current?.placement === nextIndicator?.placement
        ? current
        : nextIndicator,
    )
  }

  function handleServerDragEnd(event: DragEndEvent) {
    document.body.classList.remove('is-server-rail-dragging')
    setDropIndicator(null)

    const activeServerId = String(event.active.id)
    const overServerId = event.over ? String(event.over.id) : null

    if (overServerId && activeServerId !== overServerId) {
      onReorderServers(activeServerId, overServerId)
    }
  }

  function handleServerDragCancel() {
    document.body.classList.remove('is-server-rail-dragging')
    setDropIndicator(null)
  }

  return (
    <aside
      className={`${styles.drawer} ${isOpen ? styles.open : ''}`}
      aria-label="Navigation"
    >
      <button
        className={`${styles.avatar} ui-frame`}
        type="button"
        onClick={onOpenProfile}
        aria-label="Open profile"
        title="Profile"
      >
        <img className="ui-media-fit" src={avatarSrc} alt="" />
      </button>

      <div
        className={`${styles.list} ${
          isLoadingServers ? styles.loadingList : ''
        } ui-scrollbar-none`}
        aria-busy={isLoadingServers}
      >
        {isLoadingServers ? (
          serverRailSkeletonKeys.map((key) => (
            <SystemSkeleton
              key={key}
              className={styles.serverSkeleton}
              height="var(--profile-rail-server)"
              variant="block"
              width="var(--profile-rail-server)"
            />
          ))
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={serverRailCollisionDetection}
              autoScroll={false}
              onDragStart={handleServerDragStart}
              onDragOver={handleServerDragOver}
              onDragEnd={handleServerDragEnd}
              onDragCancel={handleServerDragCancel}
            >
              {memberships.map((membership) => (
                <ServerRailItem
                  key={membership.id}
                  membership={membership}
                  isSelected={selectedServerId === membership.server.id}
                  voiceParticipants={
                    selectedServerId === membership.server.id
                      ? selectedServerVoiceParticipants
                      : []
                  }
                  voiceParticipantMembers={
                    selectedServerId === membership.server.id
                      ? selectedServerMembers
                      : []
                  }
                  dropPlacement={
                    dropIndicator?.serverId === membership.serverId
                      ? dropIndicator.placement
                      : null
                  }
                  onOpenServer={onOpenServer}
                  onOpenContextMenu={onOpenContextMenu}
                />
              ))}
            </DndContext>
            <button
              className={`${styles.server} ${styles.createServer}`}
              type="button"
              onClick={onCreateServer}
              aria-label={serverCopy.actions.createServer}
              title={serverCopy.actions.createServer}
            >
              <span className={`${styles.icon} ui-frame`} aria-hidden="true">
                <SystemPlusIcon size="large" />
              </span>
            </button>
          </>
        )}
      </div>

      <div className={styles.utilities} aria-label="Hub actions">
        <button
          className={styles.tool}
          type="button"
          onClick={onShowFriends}
          aria-label={communityCopy.tabs.friends}
          title={communityCopy.tabs.friends}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="friends" size={22} />
          </span>
        </button>
        <button
          className={styles.tool}
          type="button"
          onClick={onShowInvites}
          aria-label={communityCopy.direct.invitesTitle}
          title={communityCopy.direct.invitesTitle}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="mail" size={22} />
          </span>
        </button>
        <button
          className={styles.tool}
          type="button"
          onClick={onShowAllServers}
          aria-label={commonCopy.navigation.servers}
          title={communityCopy.direct.allServers}
        >
          <span className={styles.toolIcon} aria-hidden="true">
            <SystemIcon name="globe" size={22} />
          </span>
        </button>
      </div>
    </aside>
  )
}

function ServerRailItem({
  membership,
  isSelected,
  voiceParticipants,
  voiceParticipantMembers,
  dropPlacement,
  onOpenServer,
  onOpenContextMenu,
}: {
  membership: ServerMemberResponse
  isSelected: boolean
  voiceParticipants: VoiceParticipant[]
  voiceParticipantMembers: ServerMemberDetailsResponse[]
  dropPlacement: ServerDropPlacement | null
  onOpenServer: (membership: ServerMemberResponse) => void
  onOpenContextMenu: (
    event: MouseEvent<HTMLButtonElement>,
    membership: ServerMemberResponse,
  ) => void
}) {
  const { server } = membership
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: membership.serverId,
  })
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: membership.serverId,
  })
  const setServerButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node
      setDraggableRef(node)
    },
    [setDraggableRef],
  )
  const tooltipId = `server-tooltip-${server.id}`
  const unreadLabel = getUnreadMessageLabel(membership.unreadCount)
  const dragStyle = transform
    ? ({
        transform: `translate3d(0, ${transform.y}px, 0)`,
        transition: 'none',
        willChange: 'transform',
      } satisfies CSSProperties)
    : undefined

  return (
    <div
      ref={setDroppableRef}
      className={`${styles.serverDropSlot} ${
        dropPlacement === 'before' ? styles.dropBefore : ''
      } ${dropPlacement === 'after' ? styles.dropAfter : ''}`}
    >
      <button
        ref={setServerButtonRef}
        className={`${styles.server} ${isSelected ? styles.selected : ''} ${
          isDragging ? styles.dragging : ''
        }`}
        type="button"
        style={dragStyle}
        onClick={() => onOpenServer(membership)}
        onContextMenu={(event) => onOpenContextMenu(event, membership)}
        onPointerEnter={() => setIsTooltipOpen(true)}
        onPointerLeave={() => setIsTooltipOpen(false)}
        onFocus={() => setIsTooltipOpen(true)}
        onBlur={() => setIsTooltipOpen(false)}
        aria-label={
          unreadLabel
            ? `Открыть сервер ${server.title}. ${unreadLabel}`
            : `Открыть сервер ${server.title}`
        }
        {...listeners}
        {...attributes}
      >
        <span className={`${styles.icon} ui-frame`}>
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
      </button>
      <UnreadBadge
        className={styles.unreadBadge}
        count={membership.unreadCount}
      />
      <ServerTooltip
        anchorRef={buttonRef}
        id={tooltipId}
        isOpen={isTooltipOpen && !isDragging}
        members={voiceParticipantMembers}
        participants={voiceParticipants}
        serverTitle={server.title}
      />
    </div>
  )
}

function getServerDropIndicator(
  memberships: ServerMemberResponse[],
  activeServerId: string,
  overServerId: string | null,
): ServerDropIndicator | null {
  if (!overServerId || activeServerId === overServerId) {
    return null
  }

  const activeIndex = memberships.findIndex(
    (membership) => membership.serverId === activeServerId,
  )
  const overIndex = memberships.findIndex(
    (membership) => membership.serverId === overServerId,
  )

  if (activeIndex < 0 || overIndex < 0) {
    return null
  }

  return {
    serverId: overServerId,
    placement: activeIndex < overIndex ? 'after' : 'before',
  }
}

const serverRailCollisionDetection: CollisionDetection = (args) =>
  closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => container.id !== args.active.id,
    ),
  })
