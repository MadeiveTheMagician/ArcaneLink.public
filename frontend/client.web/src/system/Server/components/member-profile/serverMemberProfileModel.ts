import type { CSSProperties } from 'react'
import { buildSystemThemeVariables } from '../../../../styles/systemThemeTokens'
import { getProfileColor, getSystemTheme } from '../../../../styles/systemThemes'
import type { ServerMemberViewerProfileResponse } from '../../../../shared/types'

export type ServerMemberProfileAnchor = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ServerMemberProfileViewerTheme = {
  selectedThemeCode: string
  profileColor: string | null
  applySystemThemeToOtherProfiles: boolean
}

export type ServerMemberMutualTab = 'servers' | 'friends'

const mutualTabOrder: readonly ServerMemberMutualTab[] = ['servers', 'friends']

export function isServerMemberProfileOwnedByViewer(
  currentUserId: string,
  profileUserId: string,
) {
  return currentUserId === profileUserId
}

export function resolveServerMemberMutualTabKey(
  currentTab: ServerMemberMutualTab,
  key: string,
): ServerMemberMutualTab | null {
  const currentIndex = mutualTabOrder.indexOf(currentTab)

  switch (key) {
    case 'ArrowLeft':
      return mutualTabOrder[(currentIndex - 1 + mutualTabOrder.length) % mutualTabOrder.length]
    case 'ArrowRight':
      return mutualTabOrder[(currentIndex + 1) % mutualTabOrder.length]
    case 'Home':
      return mutualTabOrder[0]
    case 'End':
      return mutualTabOrder[mutualTabOrder.length - 1]
    default:
      return null
  }
}

export function isServerMemberMutualListTruncated(
  totalCount: number,
  returnedCount: number,
) {
  return totalCount > returnedCount
}

export function resolveCompactProfilePosition(
  anchor: ServerMemberProfileAnchor,
  viewport: { width: number; height: number },
) {
  const cardWidth = Math.min(356, viewport.width - 24)
  const cardHeight = Math.min(520, viewport.height - 24)
  const gap = 12
  const left = anchor.left - cardWidth - gap >= 12
    ? anchor.left - cardWidth - gap
    : Math.min(anchor.right + gap, viewport.width - cardWidth - 12)
  const top = Math.min(
    Math.max(12, anchor.top - 24),
    viewport.height - cardHeight - 12,
  )

  return { left: Math.max(12, left), top: Math.max(12, top), width: cardWidth }
}

export function buildServerMemberProfileStyle(
  profile: ServerMemberViewerProfileResponse,
  viewerTheme: ServerMemberProfileViewerTheme,
) {
  const themeCode = viewerTheme.applySystemThemeToOtherProfiles
    ? viewerTheme.selectedThemeCode
    : profile.profileThemeCode
  const profileColor = viewerTheme.applySystemThemeToOtherProfiles
    ? viewerTheme.profileColor
    : profile.profileColor
  const theme = getSystemTheme(themeCode)

  return {
    ...buildSystemThemeVariables(theme.variables),
    '--profile-accent-color': getProfileColor(theme.code, profileColor),
    '--theme-accent': 'var(--profile-accent-color)',
    ...(profile.profileBackgroundAssetId
      ? {
          '--server-member-profile-background':
            `url("/api/assets/${profile.profileBackgroundAssetId}/content")`,
        }
      : {}),
  } as CSSProperties
}

export function formatServerMemberJoinedAt(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
