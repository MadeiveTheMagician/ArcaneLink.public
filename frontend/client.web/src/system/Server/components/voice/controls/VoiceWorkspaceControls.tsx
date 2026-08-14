import { useEffect, useRef, useState } from 'react'
import { voiceCopy } from '../../../../shared/copy/voice.ru.ts'
import { VoiceCallControlPanel } from './VoiceCallControlPanel'
import styles from './VoiceWorkspaceControls.module.css'

type VoiceWorkspaceControlsProps = {
  isConnected: boolean
  hasParticipantCards: boolean
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  isWorkspaceFullscreen: boolean
  showParticipantsWithoutVideo: boolean
  showSelfCamera: boolean
  onToggleMuted: () => void
  onToggleDeafened: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeaveVoiceChannel: () => void
  onOpenDetachedWorkspace: () => void
  onToggleParticipantsWithoutVideo: () => void
  onToggleSelfCamera: () => void
  onToggleWorkspaceFullscreen: () => void
}

export function VoiceWorkspaceControls({
  isConnected,
  hasParticipantCards,
  isMuted,
  isDeafened,
  isCameraEnabled,
  isScreenSharing,
  isWorkspaceFullscreen,
  showParticipantsWithoutVideo,
  showSelfCamera,
  onToggleMuted,
  onToggleDeafened,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveVoiceChannel,
  onOpenDetachedWorkspace,
  onToggleParticipantsWithoutVideo,
  onToggleSelfCamera,
  onToggleWorkspaceFullscreen,
}: VoiceWorkspaceControlsProps) {
  const [isMobilePanelCollapsed, setIsMobilePanelCollapsed] = useState(false)
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false)
  const viewSettingsRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isViewSettingsOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        viewSettingsRootRef.current?.contains(event.target)
      ) {
        return
      }

      setIsViewSettingsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsViewSettingsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isViewSettingsOpen])

  if (!isConnected) return null

  return (
    <>
      <div
        ref={viewSettingsRootRef}
        className={`${styles.voiceCallPanelShell} ${
          isMobilePanelCollapsed ? styles.voiceCallPanelShellCollapsed : ''
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className={styles.voiceCallPanelToggle}
          type="button"
          aria-label={
            isMobilePanelCollapsed
              ? voiceCopy.channel.expandConnectionPanel
              : voiceCopy.channel.collapseConnectionPanel
          }
          aria-expanded={!isMobilePanelCollapsed}
          onClick={() =>
            setIsMobilePanelCollapsed((isCollapsed) => !isCollapsed)
          }
        >
          <span aria-hidden="true" />
        </button>
        <VoiceCallControlPanel
          className={styles.voiceCallPanel}
          isMuted={isMuted}
          isDeafened={isDeafened}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          isSettingsOpen={isViewSettingsOpen}
          onToggleMuted={onToggleMuted}
          onToggleDeafened={onToggleDeafened}
          onToggleCamera={onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          onLeaveVoiceChannel={onLeaveVoiceChannel}
          onOpenSettings={() =>
            setIsViewSettingsOpen((current) => !current)
          }
        />
        <div
          className={styles.voiceWorkspaceViewSettings}
          data-open={isViewSettingsOpen ? 'true' : 'false'}
          aria-hidden={!isViewSettingsOpen}
        >
          <strong>{voiceCopy.detached.settingsTitle}</strong>
          <label>
            <span>{voiceCopy.detached.showParticipantsWithoutVideo}</span>
            <input
              type="checkbox"
              checked={showParticipantsWithoutVideo}
              onChange={onToggleParticipantsWithoutVideo}
            />
          </label>
          <label>
            <span>{voiceCopy.detached.showSelfCamera}</span>
            <input
              type="checkbox"
              checked={showSelfCamera}
              onChange={onToggleSelfCamera}
            />
          </label>
          <div className={styles.voiceWorkspaceSettingsActions}>
            <button
              type="button"
              disabled={!hasParticipantCards}
              onClick={() => {
                setIsViewSettingsOpen(false)
                onOpenDetachedWorkspace()
              }}
            >
              {voiceCopy.channel.detachWorkspaceTitle}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsViewSettingsOpen(false)
                onToggleWorkspaceFullscreen()
              }}
            >
              {isWorkspaceFullscreen
                ? voiceCopy.channel.leaveSpaceTitle
                : voiceCopy.channel.expandSpaceTitle}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
