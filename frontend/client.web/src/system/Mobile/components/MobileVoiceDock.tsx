import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type Modifier,
} from '@dnd-kit/core'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { UserResponse } from '../../../shared/types'
import type { VoiceChannelController } from '../../Server/hooks/voice/useVoiceChannel'
import { SystemIcon, voiceCopy } from '../../shared'
import styles from './MobileVoiceDock.module.css'

type MobileVoiceDockProps = {
  avatarSrc: string
  connectionTitle: string | null
  isClosing: boolean
  onOpenActiveVoiceSpace: () => void
  onOpenSettings: () => void
  user: UserResponse
  voice: VoiceChannelController
}

type DockOffset = {
  x: number
  y: number
}

const collapsedDockSize = 58
const collapsedDockEdge = 12

const keepCollapsedDockInViewport: Modifier = ({
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || typeof window === 'undefined') return transform

  return {
    ...transform,
    x: Math.min(
      Math.max(
        transform.x,
        collapsedDockEdge - draggingNodeRect.left,
      ),
      window.innerWidth -
        collapsedDockEdge -
        draggingNodeRect.right,
    ),
    y: Math.min(
      Math.max(
        transform.y,
        collapsedDockEdge - draggingNodeRect.top,
      ),
      window.innerHeight -
        collapsedDockEdge -
        draggingNodeRect.bottom,
    ),
  }
}

function CollapsedVoiceDock({
  avatarSrc,
  offset,
  onExpand,
}: {
  avatarSrc: string
  offset: DockOffset
  onExpand: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'mobile-voice-dock',
  })
  const style = {
    '--mobile-voice-dock-x': `${offset.x + (transform?.x ?? 0)}px`,
    '--mobile-voice-dock-y': `${offset.y + (transform?.y ?? 0)}px`,
  } as CSSProperties

  return (
    <button
      ref={setNodeRef}
      className={styles.collapsedDock}
      style={style}
      type="button"
      aria-label={voiceCopy.channel.expandConnectionPanel}
      onClick={onExpand}
      {...attributes}
      {...listeners}
    >
      <img src={avatarSrc} alt="" />
      <span className={styles.collapsedCallIcon} aria-hidden="true">
        <SystemIcon name="phone-call" size={14} />
      </span>
    </button>
  )
}

export function MobileVoiceDock({
  avatarSrc,
  connectionTitle,
  isClosing,
  onOpenActiveVoiceSpace,
  onOpenSettings,
  user,
  voice,
}: MobileVoiceDockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [collapsedOffset, setCollapsedOffset] = useState<DockOffset>({
    x: 0,
    y: 0,
  })
  const didDragRef = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  useEffect(() => {
    setIsCollapsed(false)
    setCollapsedOffset({ x: 0, y: 0 })
  }, [voice.connectedChannel?.channelScope, voice.connectedChannel?.spaceId])

  function handleDragMove(event: DragMoveEvent) {
    if (Math.abs(event.delta.x) > 2 || Math.abs(event.delta.y) > 2) {
      didDragRef.current = true
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const initialRect = event.active.rect.current.initial
    if (!initialRect || typeof window === 'undefined') return

    const left = Math.min(
      Math.max(
        initialRect.left + event.delta.x,
        collapsedDockEdge,
      ),
      window.innerWidth - collapsedDockEdge - collapsedDockSize,
    )
    const top = Math.min(
      Math.max(
        initialRect.top + event.delta.y,
        collapsedDockEdge,
      ),
      window.innerHeight - collapsedDockEdge - collapsedDockSize,
    )

    setCollapsedOffset((current) => ({
      x: current.x + left - initialRect.left,
      y: current.y + top - initialRect.top,
    }))
  }

  function expandCollapsedDock() {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    setIsCollapsed(false)
  }

  if (isCollapsed) {
    return (
      <DndContext
        sensors={sensors}
        modifiers={[keepCollapsedDockInViewport]}
        onDragStart={() => {
          didDragRef.current = false
        }}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <CollapsedVoiceDock
          avatarSrc={avatarSrc}
          offset={collapsedOffset}
          onExpand={expandCollapsedDock}
        />
      </DndContext>
    )
  }

  return (
    <aside
      className={`${styles.dock} ${isClosing ? styles.closing : ''}`}
      data-mobile-voice-expanded="true"
      aria-label={voiceCopy.dock.label}
    >
      <div className={styles.summary}>
        <img className={styles.avatar} src={avatarSrc} alt="" />
        <button
          className={styles.connectionText}
          type="button"
          onClick={onOpenActiveVoiceSpace}
        >
          <strong>{voiceCopy.dock.connected}</strong>
          <small>{connectionTitle}</small>
        </button>
        <button
          className={styles.collapseButton}
          type="button"
          aria-label={voiceCopy.channel.collapseConnectionPanel}
          onClick={() => setIsCollapsed(true)}
        >
          <SystemIcon name="chevron-down" size={20} />
        </button>
      </div>

      <div className={styles.actionRow}>
        <div className={styles.connectionActions}>
          <button
            className={voice.isCameraEnabled ? styles.active : ''}
            type="button"
            onClick={() => void voice.toggleCamera()}
            aria-label={voiceCopy.controls.camera}
          >
            <SystemIcon name="camera" size={19} />
          </button>
          <button
            className={voice.isScreenSharing ? styles.active : ''}
            type="button"
            onClick={() => void voice.toggleScreenShare()}
            aria-label={voiceCopy.controls.screenOn}
          >
            <SystemIcon name="screen" size={19} />
          </button>
          <button
            className={styles.leaveButton}
            type="button"
            onClick={() => void voice.leaveVoiceChannel()}
            aria-label={voiceCopy.controls.leave}
          >
            <SystemIcon name="leave" size={19} />
          </button>
        </div>

        <span className={styles.userName}>{user.displayName}</span>

        <div className={styles.userControls}>
          <button
            className={voice.isMuted ? styles.active : ''}
            type="button"
            aria-label={voiceCopy.dock.microphone}
            onClick={voice.toggleMuted}
          >
            <SystemIcon
              name={voice.isMuted ? 'mic-off' : 'mic-on'}
              size={19}
              tone={voice.isMuted ? 'danger' : 'default'}
            />
          </button>
          <button
            className={voice.isDeafened ? styles.active : ''}
            type="button"
            aria-label={voiceCopy.dock.sound}
            onClick={voice.toggleDeafened}
          >
            <SystemIcon
              name={voice.isDeafened ? 'headphones-off' : 'headphones-on'}
              size={19}
              tone={voice.isDeafened ? 'danger' : 'default'}
            />
          </button>
          <button
            type="button"
            aria-label={voiceCopy.dock.systemSettings}
            onClick={onOpenSettings}
          >
            <SystemIcon name="settings" size={19} />
          </button>
        </div>
      </div>
    </aside>
  )
}
