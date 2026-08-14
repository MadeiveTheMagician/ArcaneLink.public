import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import { apiJson, apiNoContent } from '../../../../shared/api/api'
import type {
  AssetResponse,
  CreateServerRequest,
  ServerMemberResponse,
  ServerResponse,
  UpdateServerRequest,
} from '../../../../shared/types'
import { useAssetImagePicker } from '../../../Profile/hooks/useAssetImagePicker'
import type {
  ServerDialogState,
  ServerFormState,
  ServerSettingsAccess,
  ServerSettingsSection,
} from '../../components/dialogs/ServerDialog'
import { serverCopy } from '../../../shared/index'

const serverIconAssetTypeId = '14000000-0000-0000-0000-000000000000'
const maxServerIconUploadSizeBytes = 10 * 1024 * 1024
const allowedServerIconMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
])

type AssetSort = 'newest' | 'oldest'

type UseServerDialogOptions = {
  accessToken: string
  assetSort: AssetSort
  loadServers: () => Promise<ServerMemberResponse[] | undefined>
  updateServerMembership: (server: ServerResponse) => void
  setServerMemberships: Dispatch<SetStateAction<ServerMemberResponse[]>>
  onContextMenuClose: () => void
}

const emptyServerForm: ServerFormState = {
  title: '',
  description: '',
  accessMode: 'private',
  iconAssetId: null,
  iconPreviewUrl: null,
  iconPreviewIsObjectUrl: false,
  iconCropOffsetX: 0,
  iconCropOffsetY: 0,
  iconCropZoom: 1,
}

export function useServerDialog({
  accessToken,
  assetSort,
  loadServers,
  updateServerMembership,
  setServerMemberships,
  onContextMenuClose,
}: UseServerDialogOptions) {
  const serverIconPicker = useAssetImagePicker({
    accessToken,
    libraryEndpoint: '/api/assets/me/server-icon',
    sort: assetSort,
  })
  const [serverDialog, setServerDialog] = useState<ServerDialogState | null>(
    null,
  )
  const [isServerDeleteSectionOpen, setIsServerDeleteSectionOpen] =
    useState(false)
  const [serverForm, setServerForm] =
    useState<ServerFormState>(emptyServerForm)
  const [serverNotice, setServerNotice] = useState<string | null>(null)
  const [isSavingServer, setIsSavingServer] = useState(false)

  useEffect(() => {
    return () => {
      if (serverForm.iconPreviewIsObjectUrl && serverForm.iconPreviewUrl) {
        URL.revokeObjectURL(serverForm.iconPreviewUrl)
      }
    }
  }, [serverForm.iconPreviewIsObjectUrl, serverForm.iconPreviewUrl])

  function openCreateServerDialog() {
    setServerForm(emptyServerForm)
    setServerNotice(null)
    onContextMenuClose()
    setIsServerDeleteSectionOpen(false)
    setServerDialog({ mode: 'create' })
  }

  function openServerSettings(
    membership: ServerMemberResponse,
    section: ServerSettingsSection = 'all',
    access: ServerSettingsAccess = {
      canManageProfile: true,
      canManageSettings: true,
      canDelete: true,
    },
  ) {
    setServerForm({
      title: membership.server.title,
      description: membership.server.description ?? '',
      accessMode: membership.server.accessMode,
      iconAssetId: membership.server.iconAssetId,
      iconPreviewUrl: membership.server.iconAssetId
        ? `/api/assets/${membership.server.iconAssetId}/content`
        : null,
      iconPreviewIsObjectUrl: false,
      iconCropOffsetX: membership.server.iconCropOffsetX,
      iconCropOffsetY: membership.server.iconCropOffsetY,
      iconCropZoom: membership.server.iconCropZoom,
    })
    setServerNotice(null)
    onContextMenuClose()
    setIsServerDeleteSectionOpen(section === 'delete')
    setServerDialog({
      mode: 'settings',
      membership,
      section,
      access,
    })
  }

  function updateServerForm(nextForm: Partial<ServerFormState>) {
    setServerForm((current) => ({
      ...current,
      ...nextForm,
    }))
  }

  function selectServerIconFile(file: File | undefined) {
    serverIconPicker.selectFile(file)
  }

  function clearServerIcon() {
    updateServerForm({
      iconAssetId: null,
      iconPreviewUrl: null,
      iconPreviewIsObjectUrl: false,
      iconCropOffsetX: 0,
      iconCropOffsetY: 0,
      iconCropZoom: 1,
      iconFile: undefined,
    })

    serverIconPicker.clearFileInput()
  }

  async function uploadServerIconAsset() {
    if (!serverForm.iconFile) {
      return serverForm.iconAssetId
    }

    validateServerIconFile(serverForm.iconFile)

    const formData = new FormData()
    formData.append('AssetTypeId', serverIconAssetTypeId)
    formData.append('File', serverForm.iconFile)

    const uploadedAsset = await apiJson<AssetResponse>('/api/assets/upload', {
      method: 'POST',
      accessToken,
      body: formData,
    })

    return uploadedAsset.id
  }

  function showServerIconLibrary() {
    serverIconPicker.openLibrary()
  }

  function selectServerIconAsset(asset: AssetResponse) {
    serverIconPicker.selectAsset(asset)
  }

  function cancelServerIconChange() {
    serverIconPicker.cancelCrop()
  }

  function confirmServerIconChange(crop: ImageCrop) {
    if (!serverIconPicker.draft) {
      return
    }

    if (serverForm.iconPreviewIsObjectUrl && serverForm.iconPreviewUrl) {
      URL.revokeObjectURL(serverForm.iconPreviewUrl)
    }

    updateServerForm({
      iconAssetId: serverIconPicker.draft.assetId ?? null,
      iconPreviewUrl: serverIconPicker.draft.file
        ? URL.createObjectURL(serverIconPicker.draft.file)
        : serverIconPicker.draft.previewUrl,
      iconPreviewIsObjectUrl: Boolean(serverIconPicker.draft.file),
      iconFile: serverIconPicker.draft.file,
      iconCropOffsetX: crop.offsetX,
      iconCropOffsetY: crop.offsetY,
      iconCropZoom: crop.zoom,
    })

    serverIconPicker.completeCrop()
  }

  async function submitServerForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!serverDialog) {
      return
    }

    setIsSavingServer(true)
    setServerNotice(null)

    try {
      const canManageProfile =
        serverDialog.mode === 'create' ||
        serverDialog.access.canManageProfile
      const iconAssetId = canManageProfile
        ? await uploadServerIconAsset()
        : serverForm.iconAssetId

      if (serverDialog.mode === 'create') {
        const request: CreateServerRequest = {
          title: serverForm.title,
          description: serverForm.description || null,
          iconAssetId,
          iconCropOffsetX: serverForm.iconCropOffsetX,
          iconCropOffsetY: serverForm.iconCropOffsetY,
          iconCropZoom: serverForm.iconCropZoom,
          accessMode: serverForm.accessMode,
        }

        await apiJson<ServerResponse>('/api/servers', {
          method: 'POST',
          accessToken,
          body: request,
        })
        await loadServers()
        clearServerIcon()
        setServerDialog(null)
        return
      }

      const request: UpdateServerRequest = {}
      if (serverDialog.access.canManageProfile) {
        Object.assign(request, {
          title: serverForm.title,
          description: serverForm.description || null,
          iconAssetId,
          iconCropOffsetX: serverForm.iconCropOffsetX,
          iconCropOffsetY: serverForm.iconCropOffsetY,
          iconCropZoom: serverForm.iconCropZoom,
          clearIconAsset: !iconAssetId && !serverForm.iconFile,
        })
      }
      if (serverDialog.access.canManageSettings) {
        request.accessMode = serverForm.accessMode
      }
      const updatedServer = await apiJson<ServerResponse>(
        `/api/servers/${serverDialog.membership.serverId}`,
        {
          method: 'PATCH',
          accessToken,
          body: request,
        },
      )
      updateServerMembership(updatedServer)
      updateServerForm({
        iconAssetId: updatedServer.iconAssetId,
        iconPreviewUrl: updatedServer.iconAssetId
          ? `/api/assets/${updatedServer.iconAssetId}/content`
          : null,
        iconPreviewIsObjectUrl: false,
        iconFile: undefined,
        iconCropOffsetX: updatedServer.iconCropOffsetX,
        iconCropOffsetY: updatedServer.iconCropOffsetY,
        iconCropZoom: updatedServer.iconCropZoom,
      })
      setServerDialog({
        ...serverDialog,
        membership: {
          ...serverDialog.membership,
          server: updatedServer,
        },
      })
      setServerNotice(serverCopy.dialog.updated)
    } catch (error) {
      setServerNotice(
        error instanceof Error
          ? error.message
          : serverCopy.assets.iconSaveFailed,
      )
    } finally {
      setIsSavingServer(false)
    }
  }

  async function deleteServer(membership: ServerMemberResponse) {
    setIsSavingServer(true)
    setServerNotice(null)

    try {
      await apiNoContent(`/api/servers/${membership.serverId}`, {
        method: 'DELETE',
        accessToken,
      })

      setServerMemberships((current) =>
        current.filter((item) => item.serverId !== membership.serverId),
      )
      setServerDialog(null)
    } finally {
      setIsSavingServer(false)
    }
  }

  return {
    serverIconInputRef: serverIconPicker.fileInputRef,
    serverIconDraft: serverIconPicker.draft,
    isServerIconDialogOpen: serverIconPicker.isCropDialogOpen,
    isServerIconLibraryOpen: serverIconPicker.isLibraryOpen,
    isLoadingServerIconAssets: serverIconPicker.isLoadingAssets,
    sortedServerIconAssets: serverIconPicker.sortedAssets,
    loadServerIconAssets: serverIconPicker.loadAssets,
    serverDialog,
    serverForm,
    serverNotice,
    isSavingServer,
    isServerDeleteSectionOpen,
    setIsServerIconLibraryOpen: serverIconPicker.setIsLibraryOpen,
    setServerDialog,
    openCreateServerDialog,
    openServerSettings,
    updateServerForm,
    selectServerIconFile,
    clearServerIcon,
    showServerIconLibrary,
    selectServerIconAsset,
    cancelServerIconChange,
    confirmServerIconChange,
    submitServerForm,
    deleteServer,
    setIsServerDeleteSectionOpen,
  }
}

function validateServerIconFile(file: File) {
  if (file.size > maxServerIconUploadSizeBytes) {
    throw new Error(serverCopy.assets.iconTooLarge)
  }

  if (!allowedServerIconMimeTypes.has(file.type)) {
    throw new Error(serverCopy.assets.iconUnsupportedType)
  }
}
