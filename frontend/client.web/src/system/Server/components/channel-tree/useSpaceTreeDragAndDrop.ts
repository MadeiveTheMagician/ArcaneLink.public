import { useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { ReorderSpacesRequest, SpaceResponse } from '../../../../shared/types'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import {
  buildRootSpaceReorderRequest,
  buildSpaceReorderRequest,
  getSpaceDropMode,
  wouldCreateSpaceCycle,
} from './spaceReorderModel'
import type { SpaceDropMode } from './spaceReorderModel'
import {
  canApplySpaceReorder,
  canManageSpace,
} from '../../utils/spaceCapabilities'

const SPACE_DRAG_DATA_TYPE = 'application/x-arcanelink-space-id'
const VOICE_PARTICIPANT_DRAG_DATA_TYPE =
  'application/x-arcanelink-voice-participant'

export type SpaceDropTarget = {
  targetSpaceId: string
  mode: SpaceDropMode
}

export type VoiceParticipantDragState = {
  sourceSpaceId: string
  participantId: string
}

export function isVoiceParticipantDrag(event: ReactDragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes(
    VOICE_PARTICIPANT_DRAG_DATA_TYPE,
  )
}

type Options = {
  spaces: SpaceResponse[]
  canDragSpaces: boolean
  canManageServer: boolean
  canMoveVoiceParticipants: boolean
  onReorderSpaces: (request: ReorderSpacesRequest) => Promise<boolean>
  onMoveVoiceParticipant: (
    sourceSpaceId: string,
    targetSpaceId: string,
    participantId: string,
  ) => Promise<void>
  setSpaceDragImage: (event: ReactDragEvent<HTMLElement>) => void
  setVoiceParticipantDragImage: (event: ReactDragEvent<HTMLElement>) => void
}

export function useSpaceTreeDragAndDrop(options: Options) {
  const {
    spaces,
    canDragSpaces,
    canManageServer,
    canMoveVoiceParticipants,
    onReorderSpaces,
    onMoveVoiceParticipant,
    setSpaceDragImage,
    setVoiceParticipantDragImage,
  } = options
  const [draggedSpaceId, setDraggedSpaceId] = useState<string | null>(null)
  const [spaceDropTarget, setSpaceDropTarget] = useState<SpaceDropTarget | null>(null)
  const [isRootSpaceDropTarget, setIsRootSpaceDropTarget] = useState(false)
  const [spaceDragClickSuppressionId, setSpaceDragClickSuppressionId] =
    useState<string | null>(null)
  const [draggedVoiceParticipant, setDraggedVoiceParticipant] =
    useState<VoiceParticipantDragState | null>(null)
  const [voiceDropTargetSpaceId, setVoiceDropTargetSpaceId] =
    useState<string | null>(null)

  function clearSpaceDragState() {
    setDraggedSpaceId(null)
    setSpaceDropTarget(null)
    setIsRootSpaceDropTarget(false)
  }

  function clearVoiceDragState() {
    setDraggedVoiceParticipant(null)
    setVoiceDropTargetSpaceId(null)
  }

  function consumeSuppressedSpaceClick(spaceId: string) {
    if (spaceDragClickSuppressionId !== spaceId) return false
    setSpaceDragClickSuppressionId(null)
    return true
  }

  function startSpaceDrag(event: ReactDragEvent<HTMLElement>, space: SpaceResponse) {
    if (!canDragSpaces || !canManageSpace(space)) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(SPACE_DRAG_DATA_TYPE, space.id)
    event.dataTransfer.setData('text/plain', space.title)
    setSpaceDragImage(event)
    setDraggedSpaceId(space.id)
    setSpaceDragClickSuppressionId(space.id)
  }

  function updateSpaceDropTarget(
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
    modeOverride?: SpaceDropMode,
  ) {
    if (!canDragSpaces || !canManageSpace(target)) return
    const activeSpaceId =
      draggedSpaceId || event.dataTransfer.getData(SPACE_DRAG_DATA_TYPE)
    if (!activeSpaceId || activeSpaceId === target.id) return

    const nextTarget: SpaceDropTarget = {
      targetSpaceId: target.id,
      mode: modeOverride ?? getDropMode(event, target),
    }
    if (
      nextTarget.mode === 'inside' &&
      (target.typeCode !== 'category' ||
        wouldCreateSpaceCycle(activeSpaceId, target.id, spaces))
    ) return
    const request = buildSpaceReorderRequest(
      spaces,
      activeSpaceId,
      target.id,
      nextTarget.mode,
    )
    if (!canApplySpaceReorder(spaces, request, canManageServer)) return

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setIsRootSpaceDropTarget(false)
    setSpaceDropTarget(nextTarget)
  }

  async function dropSpaceOnTarget(
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
    modeOverride?: SpaceDropMode,
  ) {
    if (!canDragSpaces || !canManageSpace(target)) return
    const activeSpaceId =
      draggedSpaceId || event.dataTransfer.getData(SPACE_DRAG_DATA_TYPE)
    if (!activeSpaceId || activeSpaceId === target.id) {
      clearSpaceDragState()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const mode =
      spaceDropTarget?.targetSpaceId === target.id
        ? spaceDropTarget.mode
        : modeOverride ?? getDropMode(event, target)
    const request = buildSpaceReorderRequest(spaces, activeSpaceId, target.id, mode)
    clearSpaceDragState()
    if (canApplySpaceReorder(spaces, request, canManageServer)) {
      await onReorderSpaces(request)
    }
  }

  function updateRootSpaceDropTarget(event: ReactDragEvent<HTMLElement>) {
    if (!canDragSpaces) return
    const activeSpaceId =
      draggedSpaceId || event.dataTransfer.getData(SPACE_DRAG_DATA_TYPE)
    if (!activeSpaceId) return
    const request = buildRootSpaceReorderRequest(spaces, activeSpaceId)
    if (!canApplySpaceReorder(spaces, request, canManageServer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setSpaceDropTarget(null)
    setIsRootSpaceDropTarget(true)
  }

  async function dropSpaceOnRoot(event: ReactDragEvent<HTMLElement>) {
    if (!canDragSpaces) return
    const activeSpaceId =
      draggedSpaceId || event.dataTransfer.getData(SPACE_DRAG_DATA_TYPE)
    if (!activeSpaceId) {
      clearSpaceDragState()
      return
    }
    event.preventDefault()
    const request = buildRootSpaceReorderRequest(spaces, activeSpaceId)
    clearSpaceDragState()
    if (canApplySpaceReorder(spaces, request, canManageServer)) {
      await onReorderSpaces(request)
    }
  }

  function clearRootSpaceDropTarget(event: ReactDragEvent<HTMLElement>) {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }
    setIsRootSpaceDropTarget(false)
  }

  function startVoiceParticipantDrag(
    event: ReactDragEvent<HTMLElement>,
    sourceSpaceId: string,
    participant: VoiceParticipant,
  ) {
    const sourceSpace = spaces.find((space) => space.id === sourceSpaceId)
    if (!canMoveVoiceParticipants || !canManageSpace(sourceSpace)) {
      event.preventDefault()
      return
    }
    const payload: VoiceParticipantDragState = {
      sourceSpaceId,
      participantId: participant.participantId,
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      VOICE_PARTICIPANT_DRAG_DATA_TYPE,
      JSON.stringify(payload),
    )
    event.dataTransfer.setData('text/plain', participant.displayName)
    setVoiceParticipantDragImage(event)
    setDraggedVoiceParticipant(payload)
  }

  function updateVoiceParticipantDropTarget(
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
  ) {
    if (
      !canMoveVoiceParticipants ||
      target.typeCode !== 'voice_room' ||
      !canManageSpace(target)
    ) return
    const payload = getVoiceParticipantDragPayload(event, draggedVoiceParticipant)
    if (!payload || payload.sourceSpaceId === target.id) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setVoiceDropTargetSpaceId(target.id)
  }

  async function dropVoiceParticipantOnTarget(
    event: ReactDragEvent<HTMLElement>,
    target: SpaceResponse,
  ) {
    if (
      !canMoveVoiceParticipants ||
      target.typeCode !== 'voice_room' ||
      !canManageSpace(target)
    ) return
    const payload = getVoiceParticipantDragPayload(event, draggedVoiceParticipant)
    if (!payload || payload.sourceSpaceId === target.id) {
      clearVoiceDragState()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    clearVoiceDragState()
    await onMoveVoiceParticipant(payload.sourceSpaceId, target.id, payload.participantId)
  }

  return {
    clearRootSpaceDropTarget,
    clearSpaceDragState,
    clearVoiceDragState,
    consumeSuppressedSpaceClick,
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
  }
}

function getDropMode(
  event: ReactDragEvent<HTMLElement>,
  target: SpaceResponse,
): SpaceDropMode {
  const rect = event.currentTarget.getBoundingClientRect()
  const offset = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
  return getSpaceDropMode(offset, target.typeCode)
}

function getVoiceParticipantDragPayload(
  event: ReactDragEvent<HTMLElement>,
  fallback: VoiceParticipantDragState | null,
) {
  const rawPayload = event.dataTransfer.getData(VOICE_PARTICIPANT_DRAG_DATA_TYPE)
  if (!rawPayload) return fallback
  try {
    const parsed = JSON.parse(rawPayload) as VoiceParticipantDragState
    if (
      typeof parsed.sourceSpaceId === 'string' &&
      typeof parsed.participantId === 'string'
    ) return parsed
  } catch {
    return fallback
  }
  return fallback
}
