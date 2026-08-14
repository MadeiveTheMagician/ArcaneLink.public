import { useRef, useState } from 'react'
import { apiJson } from '../../../shared/api/api'
import type {
  DirectMessagePermission,
  MessageBubbleAlignment,
  MessageBubbleWidth,
  MessageDisplayFormat,
  PresenceMode,
  PresenceVisibility,
  UserProfileSettingsResponse,
} from '../../../shared/types'
import {
  normalizeMessageBubbleAlignment,
  normalizeMessageBubbleWidth,
  normalizeMessageDisplayFormat,
} from '../../shared/messages/messagePresentationModel'
import { createSerializedLatestTaskQueue } from './serializedLatestTaskQueue'

export type ProfileSettingsDraft = {
  interfaceScale: number
  fontScale: number
  serverInterfaceScale: number
  isServerRailPinned: boolean
  showPrivateReadAllButton: boolean
  serverMessageDisplayFormat: MessageDisplayFormat
  privateMessageDisplayFormat: MessageDisplayFormat
  serverMessageBubbleAlignment: MessageBubbleAlignment
  privateMessageBubbleAlignment: MessageBubbleAlignment
  serverMessageBubbleWidth: MessageBubbleWidth
  privateMessageBubbleWidth: MessageBubbleWidth
  expandMessageAttachmentsByDefault: boolean
  loadExternalMediaPreviews: boolean
  horizontalVideoCardSize: number
  verticalVideoCardSize: number
  selectedThemeCode: string
  profileColor: string | null
  profileBackgroundAssetId: string | null
  applySystemThemeToOtherProfiles: boolean
  directMessagePermission: DirectMessagePermission
  presenceVisibility: PresenceVisibility
  showLastSeen: boolean
  presenceMode: PresenceMode
}

function toSettingsDraft(
  settings: UserProfileSettingsResponse | ProfileSettingsDraft,
): ProfileSettingsDraft {
  return {
    interfaceScale: settings.interfaceScale,
    fontScale: settings.fontScale,
    serverInterfaceScale: settings.serverInterfaceScale ?? 1,
    isServerRailPinned: settings.isServerRailPinned ?? false,
    showPrivateReadAllButton: settings.showPrivateReadAllButton ?? true,
    serverMessageDisplayFormat: normalizeMessageDisplayFormat(
      settings.serverMessageDisplayFormat,
    ),
    privateMessageDisplayFormat: normalizeMessageDisplayFormat(
      settings.privateMessageDisplayFormat,
    ),
    serverMessageBubbleAlignment: normalizeMessageBubbleAlignment(
      settings.serverMessageBubbleAlignment,
    ),
    privateMessageBubbleAlignment: normalizeMessageBubbleAlignment(
      settings.privateMessageBubbleAlignment,
    ),
    serverMessageBubbleWidth: normalizeMessageBubbleWidth(
      settings.serverMessageBubbleWidth,
    ),
    privateMessageBubbleWidth: normalizeMessageBubbleWidth(
      settings.privateMessageBubbleWidth,
    ),
    expandMessageAttachmentsByDefault:
      settings.expandMessageAttachmentsByDefault ?? false,
    loadExternalMediaPreviews: settings.loadExternalMediaPreviews ?? true,
    horizontalVideoCardSize: settings.horizontalVideoCardSize ?? 3,
    verticalVideoCardSize: settings.verticalVideoCardSize ?? 3,
    selectedThemeCode: settings.selectedThemeCode ?? 'sapphire',
    profileColor: settings.profileColor ?? null,
    profileBackgroundAssetId: settings.profileBackgroundAssetId ?? null,
    applySystemThemeToOtherProfiles:
      settings.applySystemThemeToOtherProfiles ?? true,
    directMessagePermission: settings.directMessagePermission ?? 'everyone',
    presenceVisibility: settings.presenceVisibility ?? 'everyone',
    showLastSeen: settings.showLastSeen ?? true,
    presenceMode: settings.presenceMode ?? 'automatic',
  }
}

export function useProfileSettings(
  accessToken: string,
  initialSettings: UserProfileSettingsResponse,
) {
  const [profileSettings, setProfileSettings] = useState<ProfileSettingsDraft>(
    () => toSettingsDraft(initialSettings),
  )
  const [settingsDraft, setSettingsDraft] = useState<ProfileSettingsDraft>(
    () => toSettingsDraft(initialSettings),
  )
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false)
  const [isLoadingProfileSettings, setIsLoadingProfileSettings] =
    useState(false)
  const [isSavingProfileSettings, setIsSavingProfileSettings] =
    useState(false)
  const saveQueueRef = useRef<
    ReturnType<
      typeof createSerializedLatestTaskQueue<UserProfileSettingsResponse>
    > | null
  >(null)

  if (saveQueueRef.current == null) {
    saveQueueRef.current =
      createSerializedLatestTaskQueue<UserProfileSettingsResponse>()
  }

  async function loadProfileSettings(silent = false) {
    const saveQueue = saveQueueRef.current!
    const saveSequenceAtStart = saveQueue.getLatestSequence()
    const hadPendingSaveAtStart = saveQueue.getPendingCount() > 0

    if (!silent) {
      setIsLoadingProfileSettings(true)
    }

    try {
      const settings = await apiJson<UserProfileSettingsResponse>(
        '/api/users/me/profile/settings',
        { accessToken },
      )
      const nextSettings = toSettingsDraft(settings)

      if (
        !hadPendingSaveAtStart &&
        saveQueue.getPendingCount() === 0 &&
        saveQueue.getLatestSequence() === saveSequenceAtStart
      ) {
        setProfileSettings(nextSettings)
        setSettingsDraft(nextSettings)
      }
    } finally {
      if (!silent) {
        setIsLoadingProfileSettings(false)
      }
    }
  }

  function openProfileSettings() {
    setSettingsDraft(profileSettings)
    setIsProfileSettingsOpen(true)
    void loadProfileSettings()
  }

  async function persistProfileSettings(nextDraft: ProfileSettingsDraft) {
    const saveQueue = saveQueueRef.current!
    setIsSavingProfileSettings(true)
    setSettingsDraft(nextDraft)

    try {
      const result = await saveQueue.enqueue(() =>
        apiJson<UserProfileSettingsResponse>(
          '/api/users/me/profile/settings',
          {
            method: 'PATCH',
            accessToken,
            body: {
              ...nextDraft,
              clearProfileColor: nextDraft.profileColor == null,
              clearProfileBackgroundAsset:
                nextDraft.profileBackgroundAssetId == null,
            },
          },
        ),
      )

      if (result.isLatest) {
        const nextSettings = toSettingsDraft(result.value)
        setProfileSettings(nextSettings)
        setSettingsDraft(nextSettings)
      }
    } finally {
      if (saveQueue.getPendingCount() === 0) {
        setIsSavingProfileSettings(false)
      }
    }
  }

  return {
    profileSettings,
    settingsDraft,
    isProfileSettingsOpen,
    isLoadingProfileSettings,
    isSavingProfileSettings,
    setSettingsDraft,
    setIsProfileSettingsOpen,
    openProfileSettings,
    loadProfileSettings,
    persistProfileSettings,
  }
}
