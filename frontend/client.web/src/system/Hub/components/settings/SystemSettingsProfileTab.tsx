import { useEffect, useRef, useState } from 'react'
import { getSystemTheme } from '../../../../styles/systemThemes'
import { apiJson } from '../../../../shared/api/api'
import type {
  PublicUserProfileResponse,
  ServerMemberResponse,
  UserResponse,
} from '../../../../shared/types'
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon'
import { settingsCopy } from '../../../shared/copy'
import { SystemTabPanel, SystemTabs } from '../../../shared'
import {
  profileBackgroundAssetLimit,
  useProfileBackgroundAssets,
} from './useProfileBackgroundAssets'
import {
  profileBannerAssetLimit,
  useProfileBannerAssets,
} from './useProfileBannerAssets'
import { useProfileTags } from './useProfileTags'
import { SettingsSection } from './SystemSettingsControls'
import sharedStyles from './SystemSettingsControls.module.css'
import styles from './SystemSettingsProfile.module.css'
import {
  createProfileDisplayNameUpdate,
  profileDisplayNameMaxLength,
  validateProfileDisplayName,
} from './profileIdentityModel'
import { ServerMemberProfileSettings } from './ServerMemberProfileSettings'
import { orderProfileTagsBySelection } from './profileTagOrderModel'

type ProfileScope = 'global' | 'servers'

type SystemSettingsProfileTabProps = {
  accessToken: string
  user: UserResponse
  serverMemberships: ServerMemberResponse[]
  settings: ProfileSettingsDraft
  onProfileIdentityChanged: () => Promise<void> | void
  onChange: (settings: ProfileSettingsDraft) => void
  onCommit: (settings: ProfileSettingsDraft) => Promise<void> | void
}

function formatAssetSize(sizeBytes: number) {
  const megabytes = sizeBytes / (1024 * 1024)

  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} ${settingsCopy.units.megabytes}`
}

export function SystemSettingsProfileTab({
  accessToken,
  user,
  serverMemberships,
  settings,
  onProfileIdentityChanged,
  onChange,
  onCommit,
}: SystemSettingsProfileTabProps) {
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const [profileScope, setProfileScope] = useState<ProfileScope>('global')
  const [displayNameDraft, setDisplayNameDraft] = useState(user.displayName)
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false)
  const [displayNameStatus, setDisplayNameStatus] = useState<
    'saved' | 'error' | null
  >(null)
  const profileTags = useProfileTags(accessToken, profileScope === 'global')
  const profileBackgrounds = useProfileBackgroundAssets(
    accessToken,
    profileScope === 'global',
  )
  const profileBanners = useProfileBannerAssets(
    accessToken,
    profileScope === 'global',
  )
  const selectedBackgroundAssetId = settings.profileBackgroundAssetId
  const systemTheme = getSystemTheme(settings.selectedThemeCode)
  const defaultBackgroundImage =
    systemTheme.variables['--theme-profile-bg-image'] ?? 'none'
  const displayNameValidation = validateProfileDisplayName(displayNameDraft)
  const displayNameUpdate = createProfileDisplayNameUpdate(
    displayNameDraft,
    user.displayName,
  )
  const orderedProfileTags = orderProfileTagsBySelection(
    profileTags.tags,
    profileTags.selectedTagIds,
  )

  useEffect(() => {
    setDisplayNameDraft(user.displayName)
    setDisplayNameStatus(null)
  }, [user.displayName, user.id])

  function commitSettings(patch: Partial<ProfileSettingsDraft>) {
    const nextSettings = { ...settings, ...patch }
    onChange(nextSettings)
    void onCommit(nextSettings)
  }

  async function saveDisplayName() {
    if (!displayNameUpdate || isSavingDisplayName) return

    setIsSavingDisplayName(true)
    setDisplayNameStatus(null)
    try {
      const profile = await apiJson<PublicUserProfileResponse>(
        '/api/users/me/profile',
        {
          method: 'PATCH',
          accessToken,
          body: displayNameUpdate,
        },
      )
      setDisplayNameDraft(profile.displayName)
      setDisplayNameStatus('saved')
      await Promise.resolve(onProfileIdentityChanged()).catch(() => undefined)
    } catch {
      setDisplayNameStatus('error')
    } finally {
      setIsSavingDisplayName(false)
    }
  }

  async function handleBackgroundFile(file: File | undefined) {
    const asset = await profileBackgrounds.upload(file)

    if (asset) {
      commitSettings({ profileBackgroundAssetId: asset.id })
    }

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = ''
    }
  }

  async function handleDeleteBackground(assetId: string) {
    const wasDeleted = await profileBackgrounds.remove(assetId)

    if (wasDeleted && selectedBackgroundAssetId === assetId) {
      commitSettings({ profileBackgroundAssetId: null })
    }
  }

  async function handleBannerFile(file: File | undefined) {
    const wasUploaded = await profileBanners.upload(file)

    if (wasUploaded) {
      await Promise.resolve(onProfileIdentityChanged()).catch(() => undefined)
    }

    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  async function handleSelectBanner(assetId: string | null) {
    if (profileBanners.selectedAssetId === assetId) return

    const wasSelected = await profileBanners.select(assetId)
    if (wasSelected) {
      await Promise.resolve(onProfileIdentityChanged()).catch(() => undefined)
    }
  }

  async function handleDeleteBanner(assetId: string) {
    const wasCurrent = profileBanners.selectedAssetId === assetId
    const wasDeleted = await profileBanners.remove(assetId)

    if (wasDeleted && wasCurrent) {
      await Promise.resolve(onProfileIdentityChanged()).catch(() => undefined)
    }
  }

  return (
    <>
      <SystemTabs
        idBase="profile-scope"
        label={settingsCopy.profile.scopeTabsLabel}
        value={profileScope}
        options={[
          { value: 'global', label: settingsCopy.profile.scopeGlobal },
          { value: 'servers', label: settingsCopy.profile.scopeServers },
        ]}
        onChange={setProfileScope}
      />

      {profileScope === 'global' ? (
        <SystemTabPanel
          className={styles.scopePanel}
          idBase="profile-scope"
          value="global"
        >
          <SettingsSection
        title={settingsCopy.profile.identityTitle}
        description={settingsCopy.profile.identityDescription}
      >
        <form
          className={styles.identityForm}
          onSubmit={(event) => {
            event.preventDefault()
            void saveDisplayName()
          }}
        >
          <label className={styles.identityField}>
            <span>
              <strong>{settingsCopy.profile.displayName}</strong>
              <small>{settingsCopy.profile.displayNameDescription}</small>
            </span>
            <input
              name="displayName"
              type="text"
              value={displayNameDraft}
              maxLength={profileDisplayNameMaxLength}
              aria-invalid={displayNameValidation !== null}
              aria-describedby="profile-display-name-status"
              autoComplete="nickname"
              onChange={(event) => {
                setDisplayNameDraft(event.target.value)
                setDisplayNameStatus(null)
              }}
            />
          </label>
          <div className={styles.identityActions}>
            <span id="profile-display-name-status" aria-live="polite">
              {displayNameValidation === 'required'
                ? settingsCopy.profile.displayNameRequired
                : displayNameValidation === 'too-long'
                  ? settingsCopy.profile.displayNameTooLong
                  : displayNameStatus === 'saved'
                    ? settingsCopy.profile.displayNameSaved
                    : displayNameStatus === 'error'
                      ? settingsCopy.errors.saveDisplayName
                      : settingsCopy.profile.displayNameLength(
                          displayNameDraft.length,
                          profileDisplayNameMaxLength,
                        )}
            </span>
            <button
              className={sharedStyles.secondaryAction}
              type="submit"
              disabled={!displayNameUpdate || isSavingDisplayName}
            >
              {isSavingDisplayName
                ? settingsCopy.profile.savingDisplayName
                : settingsCopy.profile.saveDisplayName}
            </button>
          </div>
        </form>
          </SettingsSection>

          <SettingsSection
            title={settingsCopy.profile.bannerTitle}
            description={settingsCopy.profile.bannerDescription}
          >
            <div className={styles.backgroundGrid}>
              <button
                className={`${styles.backgroundTile} ${
                  !profileBanners.selectedAssetId
                    ? styles.activeBackgroundTile
                    : ''
                }`}
                type="button"
                aria-pressed={!profileBanners.selectedAssetId}
                disabled={profileBanners.changingAssetId !== null}
                onClick={() => void handleSelectBanner(null)}
              >
                <span
                  className={`${styles.backgroundPreview} ${styles.bannerPreview}`}
                  aria-hidden="true"
                />
                <strong>{settingsCopy.profile.bannerNone}</strong>
                <small>{settingsCopy.profile.bannerLimitStatus(profileBanners.assets.length)}</small>
              </button>

              {profileBanners.assets.map((asset) => {
                const isActive = profileBanners.selectedAssetId === asset.id
                return (
                  <div className={styles.backgroundTileShell} key={asset.id}>
                    <button
                      className={`${styles.backgroundTile} ${
                        isActive ? styles.activeBackgroundTile : ''
                      }`}
                      type="button"
                      disabled={
                        profileBanners.deletingAssetId === asset.id ||
                        profileBanners.changingAssetId !== null
                      }
                      aria-pressed={isActive}
                      onClick={() => void handleSelectBanner(asset.id)}
                    >
                      <span
                        className={`${styles.backgroundPreview} ${styles.bannerPreview}`}
                        style={{
                          backgroundImage: `url("/api/assets/${asset.id}/content")`,
                        }}
                        aria-hidden="true"
                      />
                      <strong>
                        {asset.originalFileName ||
                          settingsCopy.profile.bannerFileFallback}
                      </strong>
                      <small>{formatAssetSize(asset.sizeBytes)}</small>
                    </button>
                    <button
                      className={styles.deleteBackgroundButton}
                      type="button"
                      disabled={profileBanners.deletingAssetId !== null}
                      aria-label={settingsCopy.profile.deleteBanner}
                      title={settingsCopy.profile.deleteBanner}
                      onClick={() => void handleDeleteBanner(asset.id)}
                    >
                      <SystemCloseIcon size="small" />
                    </button>
                  </div>
                )
              })}

              {profileBanners.assets.length < profileBannerAssetLimit && (
                <button
                  className={`${styles.backgroundTile} ${styles.uploadBackgroundTile}`}
                  type="button"
                  disabled={profileBanners.isUploading}
                  onClick={() => bannerInputRef.current?.click()}
                >
                  <span className={styles.uploadBackgroundIcon} aria-hidden="true">
                    <SystemPlusIcon size="large" />
                  </span>
                  <strong>
                    {profileBanners.isUploading
                      ? settingsCopy.profile.uploadingBanner
                      : settingsCopy.profile.addBanner}
                  </strong>
                  <small>{settingsCopy.profile.uploadLimit}</small>
                </button>
              )}
            </div>

            <input
              ref={bannerInputRef}
              className={styles.hiddenFileInput}
              type="file"
              accept="image/*"
              onChange={(event) =>
                void handleBannerFile(event.target.files?.[0])
              }
            />

            {profileBanners.isLoading && (
              <p className={sharedStyles.statusText}>
                {settingsCopy.profile.loadingBanners}
              </p>
            )}
            {profileBanners.error && (
              <p className={sharedStyles.statusText}>{profileBanners.error}</p>
            )}
          </SettingsSection>

          <SettingsSection
        title={settingsCopy.profile.profileTagsTitle}
        description={settingsCopy.profile.profileTagsDescription}
      >
        <div className={styles.profileTagGrid}>
          {orderedProfileTags.map((tag) => {
            const isActive = profileTags.selectedTagIds.includes(tag.id)

            return (
              <button
                className={isActive ? styles.activeProfileTag : ''}
                key={tag.id}
                type="button"
                disabled={profileTags.isSaving}
                aria-pressed={isActive}
                onClick={() => void profileTags.toggle(tag.id)}
              >
                {tag.title}
              </button>
            )
          })}
          {profileTags.tags.length === 0 && (
            <span className={sharedStyles.statusText}>
              {settingsCopy.profile.loadingProfileTags}
            </span>
          )}
        </div>
        {profileTags.error && (
          <p className={sharedStyles.statusText}>{profileTags.error}</p>
        )}
          </SettingsSection>

          <SettingsSection
        title={settingsCopy.profile.backgroundTitle}
        description={settingsCopy.profile.backgroundDescription}
      >
        <div className={styles.backgroundGrid}>
          <button
            className={`${styles.backgroundTile} ${
              !selectedBackgroundAssetId ? styles.activeBackgroundTile : ''
            }`}
            type="button"
            aria-pressed={!selectedBackgroundAssetId}
            onClick={() => commitSettings({ profileBackgroundAssetId: null })}
          >
            <span
              className={styles.backgroundPreview}
              style={{
                backgroundImage: `${defaultBackgroundImage}, var(--theme-arcane-backdrop)`,
              }}
              aria-hidden="true"
            />
            <strong>{settingsCopy.profile.backgroundDefault}</strong>
            <small>{systemTheme.title}</small>
          </button>

          {profileBackgrounds.assets.map((asset) => {
            const isActive = selectedBackgroundAssetId === asset.id

            return (
              <div className={styles.backgroundTileShell} key={asset.id}>
                <button
                  className={`${styles.backgroundTile} ${
                    isActive ? styles.activeBackgroundTile : ''
                  }`}
                  type="button"
                  disabled={profileBackgrounds.deletingAssetId === asset.id}
                  aria-pressed={isActive}
                  onClick={() =>
                    commitSettings({ profileBackgroundAssetId: asset.id })
                  }
                >
                  <span
                    className={styles.backgroundPreview}
                    style={{
                      backgroundImage: `url("/api/assets/${asset.id}/content")`,
                    }}
                    aria-hidden="true"
                  />
                  <strong>
                    {asset.originalFileName ||
                      settingsCopy.profile.backgroundFileFallback}
                  </strong>
                  <small>{formatAssetSize(asset.sizeBytes)}</small>
                </button>
                <button
                  className={styles.deleteBackgroundButton}
                  type="button"
                  disabled={profileBackgrounds.deletingAssetId !== null}
                  aria-label={settingsCopy.profile.deleteBackground}
                  title={settingsCopy.profile.deleteBackground}
                  onClick={() => void handleDeleteBackground(asset.id)}
                >
                  <SystemCloseIcon size="small" />
                </button>
              </div>
            )
          })}

          {profileBackgrounds.assets.length < profileBackgroundAssetLimit && (
            <button
              className={`${styles.backgroundTile} ${styles.uploadBackgroundTile}`}
              type="button"
              disabled={profileBackgrounds.isUploading}
              onClick={() => backgroundInputRef.current?.click()}
            >
              <span className={styles.uploadBackgroundIcon} aria-hidden="true">
                <SystemPlusIcon size="large" />
              </span>
              <strong>
                {profileBackgrounds.isUploading
                  ? settingsCopy.profile.uploadingBackground
                  : settingsCopy.profile.addBackground}
              </strong>
              <small>{settingsCopy.profile.uploadLimit}</small>
            </button>
          )}
        </div>

        <input
          ref={backgroundInputRef}
          className={styles.hiddenFileInput}
          type="file"
          accept="image/*"
          onChange={(event) =>
            void handleBackgroundFile(event.target.files?.[0])
          }
        />

        {profileBackgrounds.isLoading && (
          <p className={sharedStyles.statusText}>
            {settingsCopy.profile.loadingBackgrounds}
          </p>
        )}
        {profileBackgrounds.error && (
          <p className={sharedStyles.statusText}>{profileBackgrounds.error}</p>
        )}
        <p className={sharedStyles.statusText}>
          {settingsCopy.profile.backgroundLimitStatus.replace(
            '{count}',
            profileBackgrounds.assets.length.toString(),
          )}
        </p>
          </SettingsSection>
        </SystemTabPanel>
      ) : (
        <SystemTabPanel
          className={styles.scopePanel}
          idBase="profile-scope"
          value="servers"
        >
          <ServerMemberProfileSettings
            accessToken={accessToken}
            memberships={serverMemberships}
          />
        </SystemTabPanel>
      )}
    </>
  )
}
