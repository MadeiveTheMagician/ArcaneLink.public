import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDetachedVoiceRenderSignature } from './detachedVoiceCards'
import { loadDetachedVoiceLayoutPresetsFromApi } from './detachedVoiceLayoutApi'
import {
  loadDetachedVoiceLayoutStorage,
  saveDetachedVoiceLayoutStorage,
} from './detachedVoiceLayoutStorage'
import { openDetachedVoiceWorkspaceRuntime } from './detachedVoiceWorkspaceRuntime'
import { openDetachedVoiceParticipantRuntime } from './detachedVoiceParticipantRuntime'
import { disposeAndCloseDetachedVoiceWorkspaceWindow } from './detachedVoiceWindowLifecycle'
import type {
  DetachedVoiceWorkspaceActions,
  DetachedVoiceWorkspaceControlState,
  DetachedVoiceWorkspaceWindow,
  VoiceParticipantCard,
} from './detachedVoiceWorkspaceTypes'

type UseDetachedVoiceWorkspaceOptions = {
  accessToken: string
  workspaceKey: string
  title: string
  participantCards: VoiceParticipantCard[]
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  actions: DetachedVoiceWorkspaceActions
}

export function useDetachedVoiceWorkspace({
  accessToken,
  workspaceKey,
  title,
  participantCards,
  isMuted,
  isDeafened,
  isCameraEnabled,
  isScreenSharing,
  actions,
}: UseDetachedVoiceWorkspaceOptions) {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const detachedWindowRef = useRef<DetachedVoiceWorkspaceWindow | null>(null)
  const renderSignatureRef = useRef<string | null>(null)
  const detachedParticipantWindowsRef = useRef(
    new Map<string, DetachedVoiceWorkspaceWindow>(),
  )
  const detachedParticipantSignaturesRef = useRef(new Map<string, string>())
  const actionsRef = useRef(actions)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [detachedVoiceChatHost, setDetachedVoiceChatHost] =
    useState<HTMLElement | null>(null)
  const [isDetachedVoiceChatOpen, setIsDetachedVoiceChatOpen] = useState(false)
  const controlState: DetachedVoiceWorkspaceControlState = useMemo(
    () => ({
      isMuted,
      isDeafened,
      isCameraEnabled,
      isScreenSharing,
    }),
    [isCameraEnabled, isDeafened, isMuted, isScreenSharing],
  )

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const participantWindows = detachedParticipantWindowsRef.current
    const participantSignatures = detachedParticipantSignaturesRef.current
    setDetachedVoiceChatHost(null)
    setIsDetachedVoiceChatOpen(false)

    return () => {
      const detachedWindow = detachedWindowRef.current
      detachedWindowRef.current = null
      renderSignatureRef.current = null
      disposeAndCloseDetachedVoiceWorkspaceWindow(detachedWindow)

      participantWindows.forEach((participantWindow) => {
        disposeAndCloseDetachedVoiceWorkspaceWindow(participantWindow)
      })
      participantWindows.clear()
      participantSignatures.clear()
    }
  }, [workspaceKey])

  useEffect(() => {
    const detachedWindow = detachedWindowRef.current
    if (!detachedWindow || detachedWindow.closed) {
      return
    }

    detachedWindow.updateVoiceWorkspaceChatState?.(isDetachedVoiceChatOpen)
  }, [isDetachedVoiceChatOpen])

  useEffect(() => {
    let isDisposed = false

    void loadDetachedVoiceLayoutPresetsFromApi(accessToken)
      .then((presets) => {
        if (isDisposed) return

        const currentStorage = loadDetachedVoiceLayoutStorage()
        saveDetachedVoiceLayoutStorage({
          ...currentStorage,
          presets,
          lastPresetId: presets.some(
            (preset) => preset.id === currentStorage.lastPresetId,
          )
            ? currentStorage.lastPresetId
            : null,
        })
      })
      .catch(() => undefined)

    return () => {
      isDisposed = true
    }
  }, [accessToken])

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === surfaceRef.current)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

  useEffect(() => {
    const detachedWindow = detachedWindowRef.current

    if (!detachedWindow || detachedWindow.closed) {
      detachedWindowRef.current = null
      renderSignatureRef.current = null
      return
    }

    const nextRenderSignature = createDetachedVoiceRenderSignature(
      title,
      participantCards,
    )

    if (renderSignatureRef.current === nextRenderSignature) {
      detachedWindow.updateVoiceWorkspaceSpeakingState?.(participantCards)
      detachedWindow.updateVoiceWorkspaceControlState?.(controlState)
      return
    }

    renderSignatureRef.current = nextRenderSignature
    detachedWindow.renderVoiceWorkspaceCards?.(
      title,
      participantCards,
      controlState,
    )
  }, [title, participantCards, controlState])

  useEffect(() => {
    detachedParticipantWindowsRef.current.forEach(
      (detachedWindow, participantUserId) => {
        if (detachedWindow.closed) {
          detachedParticipantWindowsRef.current.delete(participantUserId)
          detachedParticipantSignaturesRef.current.delete(participantUserId)
          return
        }

        const participantOnlyCards = participantCards.filter(
          (card) => normalizeParticipantKey(card.participant.userId) ===
            participantUserId,
        )
        const participantName =
          participantOnlyCards[0]?.participant.displayName ?? participantUserId
        const participantTitle = `${participantName} — ${title}`
        const nextSignature = createDetachedVoiceRenderSignature(
          participantTitle,
          participantOnlyCards,
        )
        if (
          detachedParticipantSignaturesRef.current.get(participantUserId) ===
          nextSignature
        ) {
          detachedWindow.updateVoiceWorkspaceSpeakingState?.(
            participantOnlyCards,
          )
          detachedWindow.updateVoiceWorkspaceControlState?.(controlState)
          return
        }

        detachedParticipantSignaturesRef.current.set(
          participantUserId,
          nextSignature,
        )
        detachedWindow.renderVoiceWorkspaceCards?.(
          participantTitle,
          participantOnlyCards,
          controlState,
        )
      },
    )
  }, [controlState, participantCards, title])

  const openDetachedWorkspace = useCallback(() => {
    const isNewWindow =
      !detachedWindowRef.current || detachedWindowRef.current.closed
    const nextVoiceChatOpen = isNewWindow ? false : isDetachedVoiceChatOpen
    if (isNewWindow) {
      setIsDetachedVoiceChatOpen(false)
    }
    renderSignatureRef.current = null
    const detachedWindow = openDetachedVoiceWorkspaceRuntime({
      accessToken,
      spaceTitle: title,
      popupKey: workspaceKey,
      participantCards,
      controlState,
      getActions: () => ({
        ...actionsRef.current,
        onToggleVoiceChat: () =>
          setIsDetachedVoiceChatOpen((isOpen) => !isOpen),
      }),
      existingWindow: detachedWindowRef.current,
      onVoiceChatHostChange: setDetachedVoiceChatHost,
    })
    detachedWindowRef.current = detachedWindow
    detachedWindow?.updateVoiceWorkspaceChatState?.(nextVoiceChatOpen)
  }, [
    accessToken,
    controlState,
    isDetachedVoiceChatOpen,
    participantCards,
    title,
    workspaceKey,
  ])

  const closeDetachedVoiceChat = useCallback(() => {
    setIsDetachedVoiceChatOpen(false)
  }, [])

  const openDetachedParticipant = useCallback((participantUserId: string) => {
    const participantKey = normalizeParticipantKey(participantUserId)
    const participantOnlyCards = participantCards.filter(
      (card) =>
        normalizeParticipantKey(card.participant.userId) === participantKey,
    )
    if (participantOnlyCards.length === 0) {
      return
    }

    const participantName =
      participantOnlyCards[0]?.participant.displayName || participantUserId
    const participantTitle = `${participantName} — ${title}`
    const detachedWindow = openDetachedVoiceParticipantRuntime({
      participantTitle,
      popupKey: `${workspaceKey}-${participantKey}`,
      participantCards: participantOnlyCards,
      existingWindow:
        detachedParticipantWindowsRef.current.get(participantKey) ?? null,
    })
    if (!detachedWindow) {
      return
    }

    detachedParticipantWindowsRef.current.set(participantKey, detachedWindow)
    detachedParticipantSignaturesRef.current.set(
      participantKey,
      createDetachedVoiceRenderSignature(
        participantTitle,
        participantOnlyCards,
      ),
    )
  }, [participantCards, title, workspaceKey])

  const toggleFullscreen = useCallback(async () => {
    const surface = surfaceRef.current

    if (!surface) return

    if (document.fullscreenElement === surface) {
      await document.exitFullscreen()
      return
    }

    await surface.requestFullscreen()
  }, [])

  return {
    surfaceRef,
    isFullscreen,
    openDetachedParticipant,
    openDetachedWorkspace,
    detachedVoiceChatHost,
    isDetachedVoiceChatOpen,
    closeDetachedVoiceChat,
    toggleFullscreen,
  }
}

function normalizeParticipantKey(value: string) {
  return value.trim().toLowerCase()
}
