import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiJson } from '../../../../shared/api/api'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import type {
  AssetResponse,
  OwnServerMemberProfileResponse,
  ServerMemberResponse,
  UpdateServerMemberProfileRequest,
} from '../../../../shared/types'
import { AssetCropDialog } from '../../../Profile/components/assets/AssetCropDialog'
import { AssetLibraryDialog } from '../../../Profile/components/assets/AssetLibraryDialog'
import { useAssetImagePicker } from '../../../Profile/hooks/useAssetImagePicker'
import { settingsCopy } from '../../../shared/copy'
import { SystemDropdown } from '../../../shared/ui/SystemDropdown'
import { SettingsSection } from './SystemSettingsControls'
import sharedStyles from './SystemSettingsControls.module.css'
import styles from './ServerMemberProfileSettings.module.css'
import {
  createServerMemberProfileDraft,
  createServerMemberProfileUpdate,
  createServerProfileAssetReset,
  hasServerMemberProfileOverrides,
  serverProfileAboutMaxLength,
  serverProfileDisplayNameMaxLength,
  serverProfileStatusMaxLength,
  validateServerMemberProfileDraft,
  type ServerMemberProfileDraft,
} from './serverMemberProfileModel'
import {
  ServerMemberProfileRequestGate,
  type ServerMemberProfileRequestTicket,
} from './serverMemberProfileRequestGate'

const avatarAssetTypeId = '11000000-0000-0000-0000-000000000000'
const bannerAssetTypeId = '12000000-0000-0000-0000-000000000000'
const maxProfileAssetSizeBytes = 10 * 1024 * 1024
const allowedProfileImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
])
const profileImageAccept = [...allowedProfileImageMimeTypes].join(',')

type ServerMemberProfileSettingsProps = {
  accessToken: string
  memberships: ServerMemberResponse[]
}

type MutationOptions = {
  preserveTextDraft?: boolean
  successMessage: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function assetUrl(assetId: string | null) {
  return assetId ? `/api/assets/${assetId}/content` : null
}

export function ServerMemberProfileSettings({
  accessToken,
  memberships,
}: ServerMemberProfileSettingsProps) {
  const [selectedServerId, setSelectedServerId] = useState(
    memberships[0]?.serverId ?? '',
  )
  const [profile, setProfile] = useState<OwnServerMemberProfileResponse | null>(
    null,
  )
  const [draft, setDraft] = useState<ServerMemberProfileDraft | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [avatarSort, setAvatarSort] = useState<'newest' | 'oldest'>('newest')
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const selectedServerIdRef = useRef(selectedServerId)
  const requestGateRef = useRef(new ServerMemberProfileRequestGate())
  const {
    fileInputRef: avatarInputRef,
    draft: avatarDraft,
    sortedAssets: avatarAssets,
    isCropDialogOpen: isAvatarCropOpen,
    isLibraryOpen: isAvatarLibraryOpen,
    isLoadingAssets: isLoadingAvatarAssets,
    setIsLibraryOpen: setIsAvatarLibraryOpen,
    selectFile: selectAvatarFile,
    loadAssets: loadAvatarAssets,
    openLibrary: openAvatarLibrary,
    selectAsset: selectAvatarAsset,
    cancelCrop: cancelAvatarCrop,
    completeCrop: completeAvatarCrop,
  } = useAssetImagePicker({
    accessToken,
    libraryEndpoint: '/api/assets/me/avatar',
    sort: avatarSort,
  })
  const selectedMembership = memberships.find(
    (membership) => membership.serverId === selectedServerId,
  )

  useEffect(() => {
    selectedServerIdRef.current = selectedServerId
  }, [selectedServerId])

  useEffect(() => {
    if (
      selectedServerId &&
      memberships.some((membership) => membership.serverId === selectedServerId)
    ) {
      return
    }

    const nextServerId = memberships[0]?.serverId ?? ''
    requestGateRef.current.cancel()
    selectedServerIdRef.current = nextServerId
    setSelectedServerId(nextServerId)
  }, [memberships, selectedServerId])

  useEffect(() => {
    if (!selectedServerId) {
      setProfile(null)
      setDraft(null)
      return
    }

    const requestGate = requestGateRef.current
    const request = requestGate.begin(selectedServerId)
    setIsLoading(true)
    setIsSaving(false)
    setProfile(null)
    setDraft(null)
    setError(null)
    setStatus(null)

    void apiJson<OwnServerMemberProfileResponse>(
      `/api/servers/${request.serverId}/member-profiles/me`,
      { accessToken, signal: request.signal },
    )
      .then((response) => {
        if (!request.isCurrent(selectedServerIdRef.current)) return
        setProfile(response)
        setDraft(createServerMemberProfileDraft(response))
      })
      .catch((requestError: unknown) => {
        if (
          !request.isCurrent(selectedServerIdRef.current) ||
          (requestError instanceof DOMException && requestError.name === 'AbortError')
        ) {
          return
        }
        setError(settingsCopy.errors.loadServerProfile)
      })
      .finally(() => {
        if (request.isCurrent(selectedServerIdRef.current)) setIsLoading(false)
      })

    return () => requestGate.cancel()
  }, [accessToken, selectedServerId])

  function applyProfile(
    nextProfile: OwnServerMemberProfileResponse,
    preserveTextDraft = false,
  ) {
    setProfile(nextProfile)
    setDraft((currentDraft) => {
      if (!preserveTextDraft || !currentDraft) {
        return createServerMemberProfileDraft(nextProfile)
      }

      return {
        ...currentDraft,
        displayName: currentDraft.useGlobalDisplayName
          ? nextProfile.displayName
          : currentDraft.displayName,
        about: currentDraft.useGlobalAbout
          ? (nextProfile.about ?? '')
          : currentDraft.about,
      }
    })
  }

  async function runMutation(
    mutation: (
      request: ServerMemberProfileRequestTicket,
    ) => Promise<OwnServerMemberProfileResponse>,
    options: MutationOptions,
  ) {
    const request = requestGateRef.current.begin(selectedServerId)
    setIsSaving(true)
    setError(null)
    setStatus(null)
    try {
      const nextProfile = await mutation(request)
      if (!request.isCurrent(selectedServerIdRef.current)) return null
      applyProfile(nextProfile, options.preserveTextDraft)
      setStatus(options.successMessage)
      return nextProfile
    } catch (requestError) {
      if (!request.isCurrent(selectedServerIdRef.current)) return null
      const localAssetErrors = new Set<string>([
        settingsCopy.errors.serverProfileAssetMustBeImage,
        settingsCopy.errors.serverProfileAssetTooLarge,
      ])
      setError(
        requestError instanceof Error && localAssetErrors.has(requestError.message)
          ? requestError.message
          : settingsCopy.errors.saveServerProfile,
      )
      return null
    } finally {
      if (request.isCurrent(selectedServerIdRef.current)) setIsSaving(false)
    }
  }

  function patchProfile(
    request: UpdateServerMemberProfileRequest,
    options: MutationOptions,
  ) {
    return runMutation(
      (operation) =>
        apiJson<OwnServerMemberProfileResponse>(
          `/api/servers/${operation.serverId}/member-profiles/me`,
          {
            method: 'PATCH',
            accessToken,
            body: request,
            signal: operation.signal,
          },
        ),
      options,
    )
  }

  async function saveTextFields() {
    if (!profile || !draft || isSaving) return
    const update = createServerMemberProfileUpdate(profile, draft)
    if (!update) return

    await patchProfile(update, {
      successMessage: settingsCopy.profile.serverProfileSaved,
    })
  }

  async function resetProfile() {
    if (!selectedServerId || isSaving) return

    await runMutation(
      (operation) =>
        apiJson<OwnServerMemberProfileResponse>(
          `/api/servers/${operation.serverId}/member-profiles/me`,
          { method: 'DELETE', accessToken, signal: operation.signal },
        ),
      { successMessage: settingsCopy.profile.serverProfileResetDone },
    )
  }

  async function resetAsset(field: 'avatar' | 'banner') {
    await patchProfile(createServerProfileAssetReset(field), {
      preserveTextDraft: true,
      successMessage: settingsCopy.profile.serverProfileFieldReset,
    })
  }

  async function confirmAvatar(crop: ImageCrop) {
    if (!avatarDraft || isSaving) return

    const nextProfile = await runMutation(
      async (operation) => {
        let avatarAssetId = avatarDraft.assetId

        if (!avatarAssetId && avatarDraft.file) {
          validateImageFile(avatarDraft.file)
          const formData = new FormData()
          formData.append('AssetTypeId', avatarAssetTypeId)
          formData.append('File', avatarDraft.file)
          const asset = await apiJson<AssetResponse>('/api/assets/upload', {
            method: 'POST',
            accessToken,
            body: formData,
            signal: operation.signal,
          })
          avatarAssetId = asset.id
        }

        if (!avatarAssetId) throw new Error('avatar-asset-missing')

        return await apiJson<OwnServerMemberProfileResponse>(
          `/api/servers/${operation.serverId}/member-profiles/me/avatar/${avatarAssetId}`,
          {
            method: 'POST',
            accessToken,
            body: {
              cropOffsetX: crop.offsetX,
              cropOffsetY: crop.offsetY,
              cropZoom: crop.zoom,
            },
            signal: operation.signal,
          },
        )
      },
      {
        preserveTextDraft: true,
        successMessage: settingsCopy.profile.serverProfileAvatarSaved,
      },
    )

    if (nextProfile) {
      completeAvatarCrop()
      void loadAvatarAssets()
    }
  }

  async function uploadBanner(file: File | undefined) {
    if (!file || isSaving) return

    await runMutation(
      async (operation) => {
        validateImageFile(file)
        const formData = new FormData()
        formData.append('AssetTypeId', bannerAssetTypeId)
        formData.append('File', file)
        const asset = await apiJson<AssetResponse>('/api/assets/upload', {
          method: 'POST',
          accessToken,
          body: formData,
          signal: operation.signal,
        })

        return await apiJson<OwnServerMemberProfileResponse>(
          `/api/servers/${operation.serverId}/member-profiles/me`,
          {
            method: 'PATCH',
            accessToken,
            body: { bannerAssetId: asset.id },
            signal: operation.signal,
          },
        )
      },
      {
        preserveTextDraft: true,
        successMessage: settingsCopy.profile.serverProfileBannerSaved,
      },
    )

    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  function chooseServer(serverId: string) {
    requestGateRef.current.cancel()
    selectedServerIdRef.current = serverId
    cancelAvatarCrop()
    setIsAvatarLibraryOpen(false)
    setSelectedServerId(serverId)
  }

  const validation = draft
    ? validateServerMemberProfileDraft(draft)
    : null
  const textUpdate = profile && draft
    ? createServerMemberProfileUpdate(profile, draft)
    : null
  const avatarImageUrl = profile ? assetUrl(profile.avatarAssetId) : null
  const bannerImageUrl = profile ? assetUrl(profile.bannerAssetId) : null
  const avatarDisplayTransform = profile
    ? profile.inheritance.avatar
      ? `translate(-50%, -50%) translate(${profile.avatarCropOffsetX * 100}%, ${profile.avatarCropOffsetY * 100}%) scale(${profile.avatarCropZoom})`
      : 'translate(-50%, -50%)'
    : undefined

  return (
    <>
      <SettingsSection
        title={settingsCopy.profile.serverProfilesTitle}
        description={settingsCopy.profile.serverProfilesDescription}
      >
        {memberships.length > 0 ? (
          <div className={styles.serverSelector}>
            <span>{settingsCopy.profile.serverProfileSelect}</span>
            <SystemDropdown
              value={selectedServerId}
              ariaLabel={settingsCopy.profile.serverProfileSelect}
              disabled={isLoading || isSaving}
              options={memberships.map((membership) => ({
                value: membership.serverId,
                label: membership.server.title,
              }))}
              onChange={chooseServer}
            />
          </div>
        ) : (
          <p className={sharedStyles.statusText}>
            {settingsCopy.profile.serverProfileNoServers}
          </p>
        )}
        {isLoading && (
          <p className={sharedStyles.statusText}>
            {settingsCopy.profile.serverProfileLoading}
          </p>
        )}
        {error && <p className={styles.errorText}>{error}</p>}
      </SettingsSection>

      {profile && draft && selectedMembership && (
        <>
          <SettingsSection
            title={selectedMembership.server.title}
            description={settingsCopy.profile.serverProfilePreviewDescription}
          >
            <article className={styles.profilePreview}>
              <div
                className={styles.previewBanner}
                style={
                  bannerImageUrl
                    ? { backgroundImage: `url("${bannerImageUrl}")` }
                    : undefined
                }
              >
                <span className={styles.previewAvatar}>
                  <img
                    src={avatarImageUrl ?? '/brand/default-avatar.svg'}
                    alt=""
                    style={{ transform: avatarDisplayTransform }}
                  />
                </span>
              </div>
              <div className={styles.previewBody}>
                <strong>{profile.displayName}</strong>
                <span>@{profile.login}</span>
                {profile.statusText && <em>{profile.statusText}</em>}
                {profile.about && <p>{profile.about}</p>}
              </div>
            </article>
            <div className={styles.previewActions}>
              <span>
                {hasServerMemberProfileOverrides(profile)
                  ? settingsCopy.profile.serverProfileHasOverrides
                  : settingsCopy.profile.serverProfileFullyInherited}
              </span>
              <button
                className={sharedStyles.secondaryAction}
                type="button"
                disabled={isSaving || !hasServerMemberProfileOverrides(profile)}
                onClick={() => void resetProfile()}
              >
                {settingsCopy.profile.serverProfileResetAll}
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            title={settingsCopy.profile.serverProfileTextTitle}
            description={settingsCopy.profile.serverProfileTextDescription}
          >
            <form
              className={styles.profileForm}
              onSubmit={(event) => {
                event.preventDefault()
                void saveTextFields()
              }}
            >
              <ProfileTextField
                label={settingsCopy.profile.displayName}
                description={settingsCopy.profile.serverProfileDisplayNameDescription}
                inherited={draft.useGlobalDisplayName}
                inheritLabel={settingsCopy.profile.serverProfileUseGlobal}
                customizeLabel={settingsCopy.profile.serverProfileCustomize}
                disabled={isSaving}
                onToggleInheritance={() =>
                  setDraft({
                    ...draft,
                    useGlobalDisplayName: !draft.useGlobalDisplayName,
                  })
                }
              >
                <input
                  type="text"
                  aria-label={settingsCopy.profile.displayName}
                  value={draft.displayName}
                  disabled={draft.useGlobalDisplayName || isSaving}
                  maxLength={serverProfileDisplayNameMaxLength}
                  onChange={(event) =>
                    setDraft({ ...draft, displayName: event.target.value })
                  }
                />
              </ProfileTextField>

              <ProfileTextField
                label={settingsCopy.profile.serverProfileAbout}
                description={settingsCopy.profile.serverProfileAboutDescription}
                inherited={draft.useGlobalAbout}
                inheritLabel={settingsCopy.profile.serverProfileUseGlobal}
                customizeLabel={settingsCopy.profile.serverProfileCustomize}
                disabled={isSaving}
                onToggleInheritance={() =>
                  setDraft({ ...draft, useGlobalAbout: !draft.useGlobalAbout })
                }
              >
                <textarea
                  aria-label={settingsCopy.profile.serverProfileAbout}
                  value={draft.about}
                  disabled={draft.useGlobalAbout || isSaving}
                  maxLength={serverProfileAboutMaxLength}
                  rows={4}
                  onChange={(event) =>
                    setDraft({ ...draft, about: event.target.value })
                  }
                />
              </ProfileTextField>

              <ProfileTextField
                label={settingsCopy.profile.serverProfileStatus}
                description={settingsCopy.profile.serverProfileStatusDescription}
                inherited={false}
              >
                <span className={styles.inlineControl}>
                  <input
                    type="text"
                    aria-label={settingsCopy.profile.serverProfileStatus}
                    value={draft.statusText}
                    disabled={isSaving}
                    maxLength={serverProfileStatusMaxLength}
                    placeholder={settingsCopy.profile.serverProfileStatusPlaceholder}
                    onChange={(event) =>
                      setDraft({ ...draft, statusText: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    disabled={isSaving || !draft.statusText}
                    onClick={() => setDraft({ ...draft, statusText: '' })}
                  >
                    {settingsCopy.profile.serverProfileClearStatus}
                  </button>
                </span>
              </ProfileTextField>

              <div className={styles.formActions}>
                <span aria-live="polite">
                  {validation
                    ? serverProfileValidationCopy(validation)
                    : status ?? settingsCopy.profile.serverProfileUnsavedHint}
                </span>
                <button
                  className={sharedStyles.secondaryAction}
                  type="submit"
                  disabled={isSaving || validation !== null || !textUpdate}
                >
                  {isSaving
                    ? settingsCopy.profile.serverProfileSaving
                    : settingsCopy.profile.serverProfileSave}
                </button>
              </div>
            </form>
          </SettingsSection>

          <SettingsSection
            title={settingsCopy.profile.serverProfileMediaTitle}
            description={settingsCopy.profile.serverProfileMediaDescription}
          >
            <div className={styles.mediaGrid}>
              <article className={styles.mediaCard}>
                <span className={styles.mediaAvatar}>
                  <img
                    src={avatarImageUrl ?? '/brand/default-avatar.svg'}
                    alt=""
                    style={{ transform: avatarDisplayTransform }}
                  />
                </span>
                <div>
                  <strong>{settingsCopy.profile.serverProfileAvatar}</strong>
                  <small>
                    {profile.inheritance.avatar
                      ? settingsCopy.profile.serverProfileInherited
                      : settingsCopy.profile.serverProfileCustom}
                  </small>
                </div>
                <div className={styles.mediaActions}>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {settingsCopy.profile.serverProfileUpload}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={openAvatarLibrary}
                  >
                    {settingsCopy.profile.serverProfileLibrary}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || profile.inheritance.avatar}
                    onClick={() => void resetAsset('avatar')}
                  >
                    {settingsCopy.profile.serverProfileUseGlobal}
                  </button>
                </div>
              </article>

              <article className={styles.mediaCard}>
                <span
                  className={styles.mediaBanner}
                  style={
                    bannerImageUrl
                      ? { backgroundImage: `url("${bannerImageUrl}")` }
                      : undefined
                  }
                />
                <div>
                  <strong>{settingsCopy.profile.serverProfileBanner}</strong>
                  <small>
                    {profile.inheritance.banner
                      ? settingsCopy.profile.serverProfileInherited
                      : settingsCopy.profile.serverProfileCustom}
                  </small>
                </div>
                <div className={styles.mediaActions}>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {settingsCopy.profile.serverProfileUpload}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || profile.inheritance.banner}
                    onClick={() => void resetAsset('banner')}
                  >
                    {settingsCopy.profile.serverProfileUseGlobal}
                  </button>
                </div>
              </article>
            </div>

            <input
              ref={avatarInputRef}
              className={styles.hiddenInput}
              type="file"
              accept={profileImageAccept}
              onChange={(event) => selectAvatarFile(event.target.files?.[0])}
            />
            <input
              ref={bannerInputRef}
              className={styles.hiddenInput}
              type="file"
              accept={profileImageAccept}
              onChange={(event) => void uploadBanner(event.target.files?.[0])}
            />
          </SettingsSection>
        </>
      )}

      {isAvatarCropOpen && avatarDraft && (
        <AssetCropDialog
          imageUrl={avatarDraft.previewUrl}
          title={settingsCopy.profile.serverProfileAvatarCropTitle}
          description={settingsCopy.profile.serverProfileAvatarCropDescription}
          shape="square"
          aspectRatio="1 / 1"
          frameLabel="150 x 150"
          initialCrop={
            avatarDraft.assetId &&
            (avatarDraft.assetId === profile?.avatarSourceAssetId ||
              avatarDraft.assetId === profile?.avatarAssetId)
              ? {
                  offsetX: profile.avatarCropOffsetX,
                  offsetY: profile.avatarCropOffsetY,
                  zoom: profile.avatarCropZoom,
                }
              : undefined
          }
          isSaving={isSaving}
          error={error}
          onCancel={cancelAvatarCrop}
          onConfirm={(crop) => void confirmAvatar(crop)}
        />
      )}

      {isAvatarLibraryOpen && (
        <AssetLibraryDialog
          titleId="server-profile-avatar-library-title"
          title={settingsCopy.profile.serverProfileAvatarLibraryTitle}
          description={settingsCopy.profile.serverProfileAvatarLibraryDescription}
          emptyText={settingsCopy.profile.serverProfileAvatarLibraryEmpty}
          loadingText={settingsCopy.profile.serverProfileAvatarLibraryLoading}
          assets={avatarAssets}
          isLoading={isLoadingAvatarAssets}
          sort={avatarSort}
          isRounded
          fallbackSrc="/brand/default-avatar.svg"
          onSortChange={setAvatarSort}
          onClose={() => setIsAvatarLibraryOpen(false)}
          onSelectAsset={selectAvatarAsset}
          formatDate={formatDate}
        />
      )}
    </>
  )
}

function ProfileTextField({
  label,
  description,
  inherited,
  inheritLabel,
  customizeLabel,
  disabled = false,
  onToggleInheritance,
  children,
}: {
  label: string
  description: string
  inherited: boolean
  inheritLabel?: string
  customizeLabel?: string
  disabled?: boolean
  onToggleInheritance?: () => void
  children: ReactNode
}) {
  return (
    <div className={styles.textField}>
      <span className={styles.textFieldHeader}>
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
        {onToggleInheritance && (
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleInheritance}
          >
            {inherited ? customizeLabel : inheritLabel}
          </button>
        )}
      </span>
      {children}
      {onToggleInheritance && (
        <em>
          {inherited
            ? settingsCopy.profile.serverProfileInherited
            : settingsCopy.profile.serverProfileCustom}
        </em>
      )}
    </div>
  )
}

function serverProfileValidationCopy(
  error: Exclude<ReturnType<typeof validateServerMemberProfileDraft>, null>,
) {
  const copy = settingsCopy.profile
  const errors = {
    'display-name-required': copy.serverProfileDisplayNameRequired,
    'display-name-too-long': copy.serverProfileDisplayNameTooLong,
    'about-required': copy.serverProfileAboutRequired,
    'about-too-long': copy.serverProfileAboutTooLong,
    'status-too-long': copy.serverProfileStatusTooLong,
  }
  return errors[error]
}

function validateImageFile(file: File) {
  if (!allowedProfileImageMimeTypes.has(file.type)) {
    throw new Error(settingsCopy.errors.serverProfileAssetMustBeImage)
  }
  if (file.size > maxProfileAssetSizeBytes) {
    throw new Error(settingsCopy.errors.serverProfileAssetTooLarge)
  }
}
