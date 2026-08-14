import { voiceCopy } from '../../../../shared/index'
import { fallbackAvatarAccent } from '../../../../shared/utils/avatarAccent'
import {
  createDetachedCardArticle,
  updateDetachedSpeakingState,
} from './detachedVoiceCards'
import { selectDetachedParticipantCard } from './detachedVoiceCardVisibility'
import { prepareDetachedVoiceDocument } from './detachedVoiceDocument'
import {
  bindDetachedVoiceWorkspaceCleanup,
  openDetachedVoiceWorkspacePopup,
} from './detachedVoiceWorkspace'
import type {
  DetachedVoiceWorkspaceWindow,
  VoiceParticipantCard,
} from './detachedVoiceWorkspaceTypes'

type DetachedVoiceParticipantRuntimeOptions = {
  participantTitle: string
  popupKey: string
  participantCards: VoiceParticipantCard[]
  existingWindow: DetachedVoiceWorkspaceWindow | null
}

export function openDetachedVoiceParticipantRuntime({
  participantTitle,
  popupKey,
  participantCards,
  existingWindow,
}: DetachedVoiceParticipantRuntimeOptions) {
  const popup = openDetachedVoiceWorkspacePopup(
    participantTitle,
    `arcanelink-voice-participant-${normalizePopupKey(popupKey)}`,
    existingWindow,
  )
  if (!popup) return null

  popup.disposeVoiceWorkspaceRuntime?.()
  const { document } = popup
  let renderCleanupCallbacks: Array<() => void> = []

  function cleanupRender() {
    renderCleanupCallbacks.forEach((cleanup) => cleanup())
    renderCleanupCallbacks = []
  }

  function renderParticipant(
    nextTitle: string,
    nextCards: VoiceParticipantCard[],
  ) {
    cleanupRender()
    document.title = voiceCopy.detached.participantPopupTitle(nextTitle)
    prepareDetachedVoiceDocument(document)

    const shell = document.createElement('main')
    shell.className =
      'arcane-detached-shell arcane-detached-participant-shell'
    shell.dataset.detachedParticipantWindow = 'true'

    const stage = document.createElement('section')
    stage.className = 'arcane-detached-participant-stage'
    const card = selectDetachedParticipantCard(nextCards)

    if (card) {
      const accent = card.isSpeaking && card.mediaKind === 'camera'
        ? '80, 214, 143'
        : card.accent || fallbackAvatarAccent
      const article = createDetachedCardArticle(document, card, {
        accent,
        cleanupCallbacks: renderCleanupCallbacks,
        screenSuffix: voiceCopy.channel.screenSuffix,
      })
      article.classList.add('arcane-detached-participant-card')
      stage.append(article)
    } else {
      const empty = document.createElement('p')
      empty.className = 'arcane-detached-empty-state'
      empty.textContent = voiceCopy.state.noParticipantsWithDot
      stage.append(empty)
    }

    shell.append(stage)
    document.body.replaceChildren(shell)
  }

  popup.renderVoiceWorkspaceCards = (nextTitle, nextCards) => {
    renderParticipant(nextTitle, nextCards)
  }
  popup.updateVoiceWorkspaceSpeakingState = (nextCards) => {
    updateDetachedSpeakingState(document, nextCards)
  }
  popup.updateVoiceWorkspaceControlState = () => undefined

  const unbindCleanup = bindDetachedVoiceWorkspaceCleanup(popup, cleanupRender)
  popup.disposeVoiceWorkspaceRuntime = () => {
    cleanupRender()
    unbindCleanup()
    popup.disposeVoiceWorkspaceRuntime = undefined
  }

  renderParticipant(participantTitle, participantCards)
  popup.focus()
  return popup
}

function normalizePopupKey(value: string) {
  return value.trim().toLowerCase()
}
