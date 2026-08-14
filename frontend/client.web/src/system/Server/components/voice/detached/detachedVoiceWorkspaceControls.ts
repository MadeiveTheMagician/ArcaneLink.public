import { voiceCopy } from '../../../../shared/index'
import {
  createDetachedControlButton,
} from './detachedVoiceControls'
import {
  createDetachedControlsDock,
  createDetachedWindowControlsDock,
} from './detachedVoiceDocument'
import type {
  DetachedVoiceWorkspaceActions,
  DetachedVoiceWorkspaceControlState,
} from './detachedVoiceWorkspaceTypes'

type DetachedVoiceWorkspaceControlsOptions = {
  document: Document
  detachedWindow: Window
  controlState: DetachedVoiceWorkspaceControlState
  actions: DetachedVoiceWorkspaceActions | null
  isSettingsOpen: boolean
  isVoiceChatOpen: boolean
  onSettingsClick: (event: MouseEvent) => void
}

export function createDetachedVoiceWorkspaceControls({
  document,
  detachedWindow,
  controlState,
  actions,
  isSettingsOpen,
  isVoiceChatOpen,
  onSettingsClick,
}: DetachedVoiceWorkspaceControlsOptions) {
  const controls = createDetachedControlsDock(document)
  const voiceChatButton = createDetachedControlButton(document, {
    label: isVoiceChatOpen
      ? voiceCopy.channel.closeChat
      : voiceCopy.channel.openChat,
    icon: 'message',
    active: isVoiceChatOpen,
    onClick: () => actions?.onToggleVoiceChat?.(),
  })
  voiceChatButton.dataset.detachedVoiceChatToggle = 'true'

  controls.append(
    createDetachedControlButton(document, {
      label: controlState.isMuted
        ? voiceCopy.controls.micOn
        : voiceCopy.controls.micOff,
      icon: 'mic',
      active: !controlState.isMuted,
      controlName: 'isMuted',
      onClick: () => actions?.onToggleMuted(),
    }),
    createDetachedControlButton(document, {
      label: controlState.isDeafened
        ? voiceCopy.controls.deafenedOff
        : voiceCopy.controls.deafenedOn,
      icon: 'headphones',
      active: !controlState.isDeafened,
      controlName: 'isDeafened',
      onClick: () => actions?.onToggleDeafened(),
    }),
    createDetachedControlButton(document, {
      label: controlState.isCameraEnabled
        ? voiceCopy.controls.cameraOff
        : voiceCopy.controls.cameraOn,
      icon: 'camera',
      active: controlState.isCameraEnabled,
      controlName: 'isCameraEnabled',
      onClick: () => actions?.onToggleCamera(),
    }),
    createDetachedControlButton(document, {
      label: controlState.isScreenSharing
        ? voiceCopy.controls.screenOff
        : voiceCopy.controls.screenOn,
      icon: 'screen',
      active: controlState.isScreenSharing,
      controlName: 'isScreenSharing',
      onClick: () => actions?.onToggleScreenShare(),
    }),
    createDetachedControlButton(document, {
      label: voiceCopy.controls.settings,
      icon: 'settings',
      active: isSettingsOpen,
      onClick: onSettingsClick,
    }),
    voiceChatButton,
    createDetachedControlButton(document, {
      label: voiceCopy.controls.leave,
      icon: 'leave',
      danger: true,
      onClick: () => {
        actions?.onLeaveVoiceChannel()
        detachedWindow.close()
      },
    }),
  )

  const windowControls = createDetachedWindowControlsDock(document)
  windowControls.append(
    createDetachedControlButton(document, {
      label: voiceCopy.detached.windowFullscreen,
      icon: 'fullscreen',
      onClick: () => {
        const root = document.documentElement
        if (document.fullscreenElement) {
          void document.exitFullscreen()
        } else {
          void root.requestFullscreen()
        }
      },
    }),
    createDetachedControlButton(document, {
      label: voiceCopy.detached.windowClose,
      icon: 'close',
      onClick: () => detachedWindow.close(),
    }),
  )

  return { controls, windowControls }
}
