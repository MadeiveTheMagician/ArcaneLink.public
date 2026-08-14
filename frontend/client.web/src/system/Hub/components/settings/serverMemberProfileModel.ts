import type {
  ServerMemberProfileResponse,
  UpdateServerMemberProfileRequest,
} from '../../../../shared/types'

export const serverProfileDisplayNameMaxLength = 128
export const serverProfileAboutMaxLength = 512
export const serverProfileStatusMaxLength = 128

export type ServerMemberProfileDraft = {
  displayName: string
  about: string
  statusText: string
  useGlobalDisplayName: boolean
  useGlobalAbout: boolean
}

export type ServerMemberProfileValidationError =
  | 'display-name-required'
  | 'display-name-too-long'
  | 'about-required'
  | 'about-too-long'
  | 'status-too-long'
  | null

export type ServerProfileAssetField = 'avatar' | 'banner'

export function createServerMemberProfileDraft(
  profile: ServerMemberProfileResponse,
): ServerMemberProfileDraft {
  return {
    displayName: profile.displayName,
    about: profile.about ?? '',
    statusText: profile.statusText ?? '',
    useGlobalDisplayName: profile.inheritance.displayName,
    useGlobalAbout: profile.inheritance.about,
  }
}

export function normalizeServerProfileText(value: string) {
  return value.trim()
}

export function validateServerMemberProfileDraft(
  draft: ServerMemberProfileDraft,
): ServerMemberProfileValidationError {
  const displayName = normalizeServerProfileText(draft.displayName)
  const about = normalizeServerProfileText(draft.about)
  const statusText = normalizeServerProfileText(draft.statusText)

  if (!draft.useGlobalDisplayName && !displayName) {
    return 'display-name-required'
  }
  if (displayName.length > serverProfileDisplayNameMaxLength) {
    return 'display-name-too-long'
  }
  if (!draft.useGlobalAbout && !about) {
    // The database uses null as the inheritance marker, so an empty custom
    // About value is intentionally invalid until an explicit override flag is
    // introduced by a future schema change.
    return 'about-required'
  }
  if (about.length > serverProfileAboutMaxLength) {
    return 'about-too-long'
  }
  if (statusText.length > serverProfileStatusMaxLength) {
    return 'status-too-long'
  }

  return null
}

export function createServerMemberProfileUpdate(
  profile: ServerMemberProfileResponse,
  draft: ServerMemberProfileDraft,
): UpdateServerMemberProfileRequest | null {
  if (validateServerMemberProfileDraft(draft) !== null) return null

  const update: UpdateServerMemberProfileRequest = {}
  const displayName = normalizeServerProfileText(draft.displayName)
  const about = normalizeServerProfileText(draft.about)
  const statusText = normalizeServerProfileText(draft.statusText)

  if (draft.useGlobalDisplayName) {
    if (!profile.inheritance.displayName) update.useGlobalDisplayName = true
  } else if (
    profile.inheritance.displayName ||
    displayName !== profile.displayName
  ) {
    update.displayName = displayName
  }

  if (draft.useGlobalAbout) {
    if (!profile.inheritance.about) update.useGlobalAbout = true
  } else if (profile.inheritance.about || about !== (profile.about ?? '')) {
    update.about = about
  }

  if (!statusText && profile.statusText) {
    update.clearStatusText = true
  } else if (statusText && statusText !== (profile.statusText ?? '')) {
    update.statusText = statusText
  }

  return Object.keys(update).length > 0 ? update : null
}

export function createServerProfileAssetReset(
  field: ServerProfileAssetField,
): UpdateServerMemberProfileRequest {
  return field === 'avatar'
    ? { useGlobalAvatar: true }
    : { useGlobalBanner: true }
}

export function hasServerMemberProfileOverrides(
  profile: ServerMemberProfileResponse,
) {
  return (
    !profile.inheritance.displayName ||
    !profile.inheritance.avatar ||
    !profile.inheritance.banner ||
    !profile.inheritance.about ||
    Boolean(profile.statusText)
  )
}
