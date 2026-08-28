import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import { apiJson } from '../../../../shared/api/api'
import type {
  AssetResponse,
  ServerAccessMode,
  ServerResponse,
  UpdateServerRequest,
} from '../../../../shared/types'
import { useAssetImagePicker } from '../../../Profile/hooks/useAssetImagePicker'
import { AssetCropDialog } from '../../../Profile/components/assets/AssetCropDialog'
import { AssetLibraryDialog } from '../../../Profile/components/assets/AssetLibraryDialog'
import { serverCopy } from '../../../shared'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import buttonStyles from '../../../shared/styles/Button.module.css'
import styles from './ServerGeneralSettings.module.css'

const serverIconAssetTypeId = '14000000-0000-0000-0000-000000000000'
const maxServerIconUploadSizeBytes = 10 * 1024 * 1024
const allowedServerIconMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
])
const accessModes: ServerAccessMode[] = [
  'public',
  'restricted',
  'private',
]

type ServerGeneralForm = {
  title: string
  description: string
  accessMode: ServerAccessMode
  iconAssetId: string | null
  iconPreviewUrl: string | null
  iconPreviewIsObjectUrl: boolean
  iconCropOffsetX: number
  iconCropOffsetY: number
  iconCropZoom: number
  iconFile?: File
}

type ServerGeneralSettingsProps = {
  accessToken: string
  server: ServerResponse
  canManageProfile: boolean
  canManageSettings: boolean
  canDelete: boolean
  onUpdateServer: (
    request: UpdateServerRequest,
  ) => Promise<ServerResponse | null>
  onDeleteServer: () => Promise<void>
  onNestedOverlayChange: (isOpen: boolean) => void
}

function createForm(server: ServerResponse): ServerGeneralForm {
  return {
    title: server.title,
    description: server.description ?? '',
    accessMode: server.accessMode,
    iconAssetId: server.iconAssetId,
    iconPreviewUrl: server.iconAssetId
      ? `/api/assets/${server.iconAssetId}/content`
      : null,
    iconPreviewIsObjectUrl: false,
    iconCropOffsetX: server.iconCropOffsetX,
    iconCropOffsetY: server.iconCropOffsetY,
    iconCropZoom: server.iconCropZoom,
  }
}

export function ServerGeneralSettings({
  accessToken,
  server,
  canManageProfile,
  canManageSettings,
  canDelete,
  onUpdateServer,
  onDeleteServer,
  onNestedOverlayChange,
}: ServerGeneralSettingsProps) {
  const [form, setForm] = useState(() => createForm(server))
  const [notice, setNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false)
  const [assetSort, setAssetSort] = useState<'newest' | 'oldest'>('newest')
  const currentObjectUrlRef = useRef<string | null>(null)
  const iconPicker = useAssetImagePicker({
    accessToken,
    libraryEndpoint: '/api/assets/me/server-icon',
    sort: assetSort,
  })
  const isNestedOverlayOpen =
    iconPicker.isCropDialogOpen || iconPicker.isLibraryOpen

  useEffect(() => {
    onNestedOverlayChange(isNestedOverlayOpen)
    return () => onNestedOverlayChange(false)
  }, [isNestedOverlayOpen, onNestedOverlayChange])

  useEffect(() => {
    releaseCurrentObjectUrl()
    setForm(createForm(server))
    setNotice(null)
    setIsDeleteSectionOpen(false)
    // Reset only when the selected server changes. Server updates are applied
    // explicitly after save so an in-progress draft is never overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id])

  useEffect(
    () => () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current)
      }
    },
    [currentObjectUrlRef],
  )

  function releaseCurrentObjectUrl() {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current)
      currentObjectUrlRef.current = null
    }
  }

  function updateForm(next: Partial<ServerGeneralForm>) {
    setForm((current) => ({ ...current, ...next }))
  }

  function clearIcon() {
    releaseCurrentObjectUrl()
    updateForm({
      iconAssetId: null,
      iconPreviewUrl: null,
      iconPreviewIsObjectUrl: false,
      iconCropOffsetX: 0,
      iconCropOffsetY: 0,
      iconCropZoom: 1,
      iconFile: undefined,
    })
    iconPicker.clearFileInput()
  }

  function confirmIconChange(crop: ImageCrop) {
    const draft = iconPicker.draft
    if (!draft) return

    releaseCurrentObjectUrl()
    const previewUrl = draft.file
      ? URL.createObjectURL(draft.file)
      : draft.previewUrl
    if (draft.file) currentObjectUrlRef.current = previewUrl

    updateForm({
      iconAssetId: draft.assetId ?? null,
      iconPreviewUrl: previewUrl,
      iconPreviewIsObjectUrl: Boolean(draft.file),
      iconFile: draft.file,
      iconCropOffsetX: crop.offsetX,
      iconCropOffsetY: crop.offsetY,
      iconCropZoom: crop.zoom,
    })
    iconPicker.completeCrop()
  }

  async function uploadIconAsset() {
    if (!form.iconFile) return form.iconAssetId

    validateServerIconFile(form.iconFile)
    const body = new FormData()
    body.append('AssetTypeId', serverIconAssetTypeId)
    body.append('File', form.iconFile)
    const asset = await apiJson<AssetResponse>('/api/assets/upload', {
      method: 'POST',
      accessToken,
      body,
    })
    return asset.id
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setNotice(null)

    try {
      const iconAssetId = canManageProfile
        ? await uploadIconAsset()
        : server.iconAssetId
      const request: UpdateServerRequest = {}
      if (canManageProfile) {
        Object.assign(request, {
          title: form.title,
          description: form.description || null,
          iconAssetId,
          iconCropOffsetX: form.iconCropOffsetX,
          iconCropOffsetY: form.iconCropOffsetY,
          iconCropZoom: form.iconCropZoom,
          clearIconAsset: !iconAssetId && !form.iconFile,
        })
      }
      if (canManageSettings) request.accessMode = form.accessMode

      const updatedServer = await onUpdateServer(request)
      if (updatedServer) {
        releaseCurrentObjectUrl()
        setForm(createForm(updatedServer))
        setNotice(serverCopy.dialog.updated)
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : serverCopy.assets.iconSaveFailed,
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteServer() {
    setIsDeleting(true)
    setNotice(null)
    try {
      await onDeleteServer()
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : serverCopy.dialog.deleteFailed,
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const canEdit = canManageProfile || canManageSettings

  return (
    <section className={styles.root}>
      <header className={styles.intro}>
        <strong>{serverCopy.settings.generalTitle}</strong>
        <span>{serverCopy.settings.generalDescription}</span>
      </header>

      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {canEdit && (
        <form className={styles.form} onSubmit={submit}>
          {canManageProfile && (
            <div className={styles.iconField}>
              <button
                className={styles.iconPicker}
                type="button"
                onClick={() => iconPicker.fileInputRef.current?.click()}
                aria-label={serverCopy.dialog.chooseAvatarAria}
              >
                {form.iconPreviewUrl ? (
                  <img
                    className="ui-media-fit"
                    src={form.iconPreviewUrl}
                    alt=""
                    style={{
                      transform: `translate(${form.iconCropOffsetX * 100}%, ${form.iconCropOffsetY * 100}%) scale(${form.iconCropZoom})`,
                    }}
                  />
                ) : (
                  <span>
                    {form.title.trim()
                      ? form.title.slice(0, 1).toUpperCase()
                      : <SystemPlusIcon size="large" />}
                  </span>
                )}
              </button>
              <div>
                <strong>{serverCopy.dialog.avatar}</strong>
                <p>{serverCopy.dialog.avatarDescription}</p>
                <div className={styles.iconActions}>
                  <button
                    className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                    type="button"
                    onClick={() => iconPicker.fileInputRef.current?.click()}
                    disabled={isSaving}
                  >
                    {serverCopy.dialog.chooseAvatar}
                  </button>
                  <button
                    className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                    type="button"
                    onClick={iconPicker.openLibrary}
                    disabled={isSaving}
                  >
                    {serverCopy.dialog.savedAssets}
                  </button>
                  {(form.iconPreviewUrl || form.iconAssetId) && (
                    <button
                      className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.smallButton}`}
                      type="button"
                      onClick={clearIcon}
                      disabled={isSaving}
                    >
                      {serverCopy.dialog.removeAvatar}
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={iconPicker.fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => iconPicker.selectFile(event.target.files?.[0])}
              />
            </div>
          )}

          {canManageProfile && (
            <label>
              <span>{serverCopy.dialog.name}</span>
              <input
                className="ui-field-control"
                value={form.title}
                onChange={(event) => updateForm({ title: event.target.value })}
                minLength={3}
                maxLength={128}
                required
              />
            </label>
          )}
          {canManageProfile && (
            <label>
              <span>{serverCopy.dialog.description}</span>
              <textarea
                className="ui-field-control"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                maxLength={512}
              />
            </label>
          )}

          {canManageSettings && (
            <fieldset className={styles.accessModeFieldset}>
              <legend>{serverCopy.dialog.accessModeLabel}</legend>
              <p>{serverCopy.dialog.accessModeDescription}</p>
              <div className={styles.accessModeGrid}>
                {accessModes.map((accessMode) => {
                  const copy = serverCopy.dialog.accessModes[accessMode]
                  const isSelected = form.accessMode === accessMode
                  return (
                    <label
                      key={accessMode}
                      className={`${styles.accessModeOption} ${isSelected ? styles.accessModeOptionSelected : ''}`}
                    >
                      <input
                        type="radio"
                        name="serverAccessMode"
                        value={accessMode}
                        checked={isSelected}
                        onChange={() => updateForm({ accessMode })}
                      />
                      <span>
                        <strong>{copy.label}</strong>
                        <small>{copy.description}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className={styles.actions}>
            <button
              className={`${buttonStyles.button} ${buttonStyles.primary}`}
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? serverCopy.dialog.saving : serverCopy.dialog.save}
            </button>
          </div>
        </form>
      )}

      {canDelete && (
        <div className={styles.dangerZone}>
          <button
            className={styles.dangerToggle}
            type="button"
            onClick={() => setIsDeleteSectionOpen((current) => !current)}
            aria-expanded={isDeleteSectionOpen}
          >
            <span>{serverCopy.dialog.deleteTitle}</span>
            <strong>{isDeleteSectionOpen ? '-' : '+'}</strong>
          </button>
          <div
            className={`${styles.dangerCollapse} ${
              isDeleteSectionOpen ? styles.dangerCollapseOpen : ''
            }`}
            aria-hidden={!isDeleteSectionOpen}
            inert={!isDeleteSectionOpen || undefined}
          >
            <div className={styles.dangerContent}>
              <p>{serverCopy.dialog.deleteDescription}</p>
              <button
                className={`${buttonStyles.button} ${buttonStyles.danger}`}
                type="button"
                onClick={() => void deleteServer()}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? serverCopy.dialog.deleting : serverCopy.dialog.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {iconPicker.isCropDialogOpen && iconPicker.draft && createPortal(
        <div className={styles.nestedOverlay} data-dismissable-layer-branch="">
          <AssetCropDialog
          imageUrl={iconPicker.draft.previewUrl}
          title={serverCopy.assets.iconCropTitle}
          description={serverCopy.assets.iconCropDescription}
          shape="rounded"
          aspectRatio="1 / 1"
          frameLabel="server icon"
          initialCrop={
            iconPicker.draft.assetId === form.iconAssetId ||
            (!iconPicker.draft.assetId && iconPicker.draft.file)
              ? {
                  offsetX: form.iconCropOffsetX,
                  offsetY: form.iconCropOffsetY,
                  zoom: form.iconCropZoom,
                }
              : undefined
          }
          isSaving={isSaving}
          onCancel={iconPicker.cancelCrop}
          onConfirm={confirmIconChange}
          />
        </div>,
        document.body,
      )}

      {iconPicker.isLibraryOpen && createPortal(
        <div className={styles.nestedOverlay} data-dismissable-layer-branch="">
          <AssetLibraryDialog
          titleId="server-settings-icon-library-title"
          title={serverCopy.assets.iconLibraryTitle}
          description={serverCopy.assets.iconLibraryDescription}
          emptyText={serverCopy.assets.iconLibraryEmpty}
          loadingText={serverCopy.assets.iconLibraryLoading}
          assets={iconPicker.sortedAssets}
          isLoading={iconPicker.isLoadingAssets}
          sort={assetSort}
          isRounded
          onSortChange={setAssetSort}
          onClose={() => iconPicker.setIsLibraryOpen(false)}
          onSelectAsset={iconPicker.selectAsset}
          formatDate={formatDate}
          />
        </div>,
        document.body,
      )}
    </section>
  )
}

function validateServerIconFile(file: File) {
  if (file.size > maxServerIconUploadSizeBytes) {
    throw new Error(serverCopy.assets.iconTooLarge)
  }
  if (!allowedServerIconMimeTypes.has(file.type)) {
    throw new Error(serverCopy.assets.iconUnsupportedType)
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
