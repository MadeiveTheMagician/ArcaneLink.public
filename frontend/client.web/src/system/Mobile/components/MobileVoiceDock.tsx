import { useEffect, useState } from 'react'
import type { UserResponse } from '../../../shared/types'
import type { VoiceChannelController } from '../../Server/hooks/voice/useVoiceChannel'
import { SystemIcon, voiceCopy } from '../../shared'
import { MobileCollapsedVoiceDock, type DockPosition } from './MobileCollapsedVoiceDock'
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
  const [collapsedPosition, setCollapsedPosition] = useState<DockPosition | null>(null)

  useEffect(() => {
    if (!voice.connectedChannel?.spaceId) return
    setIsCollapsed(false)
    setCollapsedPosition(null)
  }, [voice.connectedChannel?.channelScope, voice.connectedChannel?.spaceId])

  if (isCollapsed) {
    return (
      <MobileCollapsedVoiceDock
        avatarSrc={avatarSrc}
        position={collapsedPosition}
        isClosing={isClosing}
        onMove={setCollapsedPosition}
        onExpand={() => setIsCollapsed(false)}
      />
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
