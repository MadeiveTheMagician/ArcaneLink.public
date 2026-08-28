import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import { apiJson } from '../../../../shared/api/api'
import type {
  AssetResponse,
  CreateServerRequest,
  ServerMemberResponse,
  ServerResponse,
} from '../../../../shared/types'
import { useAssetImagePicker } from '../../../Profile/hooks/useAssetImagePicker'
import type {
  ServerDialogState,
  ServerFormState,
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
    setServerDialog({ mode: 'create' })
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
      const iconAssetId = await uploadServerIconAsset()
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
    setIsServerIconLibraryOpen: serverIconPicker.setIsLibraryOpen,
    setServerDialog,
    openCreateServerDialog,
    updateServerForm,
    selectServerIconFile,
    clearServerIcon,
    showServerIconLibrary,
    selectServerIconAsset,
    cancelServerIconChange,
    confirmServerIconChange,
    submitServerForm,
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
