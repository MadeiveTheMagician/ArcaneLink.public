import { useState } from 'react'
import type {
  CreateSpaceRequest,
  DeleteSpaceRequest,
  SpaceResponse,
  SpaceTypeCode,
  UpdateSpaceRequest,
} from '../../../../shared/types'
import {
  defaultSpaceTitle,
  toChannelDetail,
  type ServerDetail,
} from '../../utils/serverWorkspaceModel'

export type CreateSpaceDialogState = {
  typeCode: SpaceTypeCode
  parentSpaceId: string | null
}

export type EditSpaceDialogState = {
  space: SpaceResponse
}

type UseServerSpaceDialogsOptions = {
  serverSpaces: SpaceResponse[]
  activeDetail: ServerDetail | null
  onCreateSpace: (request: CreateSpaceRequest) => Promise<SpaceResponse | null>
  onUpdateSpace: (
    spaceId: string,
    request: UpdateSpaceRequest,
  ) => Promise<SpaceResponse | null>
  onDeleteSpace: (
    spaceId: string,
    request?: DeleteSpaceRequest,
  ) => Promise<boolean>
  onSelectDetail: (detail: ServerDetail) => void
  onSetActiveDetail: (detail: ServerDetail | null) => void
}

export function useServerSpaceDialogs({
  serverSpaces,
  activeDetail,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onSelectDetail,
  onSetActiveDetail,
}: UseServerSpaceDialogsOptions) {
  const [createSpaceDialog, setCreateSpaceDialog] =
    useState<CreateSpaceDialogState | null>(null)
  const [editSpaceDialog, setEditSpaceDialog] =
    useState<EditSpaceDialogState | null>(null)
  const [pendingDeleteSpace, setPendingDeleteSpace] =
    useState<SpaceResponse | null>(null)
  const [spaceTitleDraft, setSpaceTitleDraft] = useState('')
  const [spaceDescriptionDraft, setSpaceDescriptionDraft] = useState('')

  function openCreateSpaceDialog(
    typeCode: SpaceTypeCode,
    parentSpaceId: string | null = null,
  ) {
    setCreateSpaceDialog({ typeCode, parentSpaceId })
    setSpaceTitleDraft(defaultSpaceTitle(typeCode))
    setSpaceDescriptionDraft('')
  }

  async function submitCreateSpace() {
    if (!createSpaceDialog || !spaceTitleDraft.trim()) {
      return
    }

    const sameParentSpaces = serverSpaces.filter(
      (space) => space.parentSpaceId === createSpaceDialog.parentSpaceId,
    )
    const space = await onCreateSpace({
      typeCode: createSpaceDialog.typeCode,
      parentSpaceId: createSpaceDialog.parentSpaceId,
      title: spaceTitleDraft.trim(),
      description: spaceDescriptionDraft.trim() || null,
      position: sameParentSpaces.length,
    })

    if (space) {
      setCreateSpaceDialog(null)
      setSpaceTitleDraft('')
      setSpaceDescriptionDraft('')

      if (space.typeCode !== 'category') {
        onSelectDetail(toChannelDetail(space))
      }
    }
  }

  function openEditSpaceDialog(space: SpaceResponse) {
    setEditSpaceDialog({ space })
    setSpaceTitleDraft(space.title)
    setSpaceDescriptionDraft(space.description ?? '')
  }

  async function submitEditSpace() {
    if (!editSpaceDialog || !spaceTitleDraft.trim()) {
      return
    }

    const space = await onUpdateSpace(editSpaceDialog.space.id, {
      title: spaceTitleDraft.trim(),
      description: spaceDescriptionDraft.trim() || null,
      clearDescription: !spaceDescriptionDraft.trim(),
    })

    if (space) {
      setEditSpaceDialog(null)
      setSpaceTitleDraft('')
      setSpaceDescriptionDraft('')

      if (activeDetail?.type === 'channel' && activeDetail.spaceId === space.id) {
        onSetActiveDetail(toChannelDetail(space))
      }
    }
  }

  async function deleteSpace(space: SpaceResponse, action: 'delete' | 'promote') {
    const isDeleted = await onDeleteSpace(space.id, {
      categoryChildrenAction: action,
    })

    if (isDeleted) {
      setPendingDeleteSpace(null)

      if (activeDetail?.type === 'channel' && activeDetail.spaceId === space.id) {
        onSetActiveDetail(null)
      }
    }
  }

  return {
    createSpaceDialog,
    deleteSpace,
    editSpaceDialog,
    openCreateSpaceDialog,
    openEditSpaceDialog,
    pendingDeleteSpace,
    setCreateSpaceDialog,
    setEditSpaceDialog,
    setPendingDeleteSpace,
    setSpaceDescriptionDraft,
    setSpaceTitleDraft,
    spaceDescriptionDraft,
    spaceTitleDraft,
    submitCreateSpace,
    submitEditSpace,
  }
}
