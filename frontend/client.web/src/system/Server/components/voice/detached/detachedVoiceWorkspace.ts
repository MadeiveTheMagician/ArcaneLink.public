import { voiceCopy } from '../../../../shared/index'
import { detachedFloatingPanelIgnoreSelector } from './detachedVoiceDocument'
import type { DetachedVoiceWorkspaceLayoutState } from './detachedVoiceLayoutTypes'
import type { DetachedVoiceWorkspaceWindow } from './detachedVoiceWorkspaceTypes'

export function openDetachedVoiceWorkspacePopup(
  spaceTitle: string,
  popupName: string,
  existingWindow: DetachedVoiceWorkspaceWindow | null,
) {
  const popup = existingWindow && !existingWindow.closed
    ? existingWindow
    : window.open(
        '',
        popupName,
        'popup=yes,width=1180,height=720,noopener=no,noreferrer=no',
      ) as DetachedVoiceWorkspaceWindow | null

  if (!popup) {
    window.alert(voiceCopy.detached.popupBlocked)
    return null
  }

  prepareDetachedVoiceWorkspacePopup(popup, spaceTitle)
  return popup
}

export function prepareDetachedVoiceWorkspacePopup(
  popup: DetachedVoiceWorkspaceWindow,
  spaceTitle: string,
) {
  const { document } = popup
  document.title = voiceCopy.detached.popupTitle(spaceTitle)

  try {
    popup.history.replaceState(
      null,
      document.title,
      `${window.location.origin}${window.location.pathname}#voice-workspace`,
    )
  } catch {
    // Some browsers keep about:blank for script-opened windows.
  }
}

export function bindDetachedVoiceWorkspaceCleanup(
  popup: DetachedVoiceWorkspaceWindow,
  cleanup: () => void,
) {
  const handleBeforeUnload = () => {
    cleanup()
    popup.renderVoiceWorkspaceCards = undefined
    popup.updateVoiceWorkspaceSpeakingState = undefined
    popup.updateVoiceWorkspaceControlState = undefined
    popup.updateVoiceWorkspaceChatState = undefined
    popup.voiceChatHost = null
  }

  popup.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    popup.removeEventListener('beforeunload', handleBeforeUnload)
  }
}

export function setDetachedVoiceSettingsButtonActive(
  document: Document,
  event: MouseEvent,
  isActive: boolean,
) {
  const button = event.currentTarget
  const elementConstructor = document.defaultView?.HTMLElement
  if (!elementConstructor || !(button instanceof elementConstructor)) {
    return
  }

  button.dataset.active = isActive ? 'true' : 'false'
}

export function createDetachedFloatingPanelsDismissHandler({
  document,
  layoutState,
  onSelectedSlotHighlightUpdate,
  onSlotMenuRender,
}: {
  document: Document
  layoutState: DetachedVoiceWorkspaceLayoutState
  onSelectedSlotHighlightUpdate: () => void
  onSlotMenuRender: () => void
}) {
  return (event: PointerEvent) => {
    const target = event.target
    const elementConstructor = document.defaultView?.Element
    if (!target || !elementConstructor || !(target instanceof elementConstructor)) {
      return
    }

    if (target.closest(detachedFloatingPanelIgnoreSelector)) {
      return
    }

    if (!layoutState.settingsMenuOpen && layoutState.selectedSlotIndex === null) {
      return
    }

    layoutState.settingsMenuOpen = false
    layoutState.selectedSlotIndex = null
    onSelectedSlotHighlightUpdate()
    onSlotMenuRender()

    const settingsMenu = document.querySelector<HTMLElement>(
      '[data-detached-settings-menu="true"]',
    )
    if (settingsMenu) {
      settingsMenu.hidden = true
    }
  }
}
