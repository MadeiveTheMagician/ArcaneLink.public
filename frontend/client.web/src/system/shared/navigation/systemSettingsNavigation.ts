export const systemSettingsTabIds = [
  'account',
  'profile',
  'interface',
  'notifications',
  'reports',
  'privacy',
  'security',
  'streaming',
  'voice',
] as const

export type SystemSettingsTabId = (typeof systemSettingsTabIds)[number]
export type SystemSettingsDestination =
  | 'dangerous-files-warning'
  | 'voice-diagnostics'

export const dangerousFilesWarningSettingsTargetId =
  'system-settings-dangerous-files-warning'
export const voiceDiagnosticsSettingsTargetId =
  'system-settings-voice-diagnostics'

export type SystemSettingsNavigationRequest = {
  requestId: string
  tab: SystemSettingsTabId
  targetId: string | null
}

export const systemSettingsNavigationEventName =
  'arcanelink:open-system-settings'

let navigationRequestSequence = 0

export function createSystemSettingsNavigationRequest(
  destination: SystemSettingsDestination,
  requestId = `${Date.now()}:${++navigationRequestSequence}`,
): SystemSettingsNavigationRequest {
  switch (destination) {
    case 'dangerous-files-warning':
      return {
        requestId,
        tab: 'security',
        targetId: dangerousFilesWarningSettingsTargetId,
      }
    case 'voice-diagnostics':
      return {
        requestId,
        tab: 'voice',
        targetId: voiceDiagnosticsSettingsTargetId,
      }
  }
}

export function resolveSystemSettingsInitialTab(
  request: SystemSettingsNavigationRequest | null | undefined,
): SystemSettingsTabId {
  return request?.tab ?? 'account'
}

export function requestSystemSettingsNavigation(
  destination: SystemSettingsDestination,
) {
  const request = createSystemSettingsNavigationRequest(destination)
  window.dispatchEvent(
    new CustomEvent<SystemSettingsNavigationRequest>(
      systemSettingsNavigationEventName,
      { detail: request },
    ),
  )
}

export function subscribeToSystemSettingsNavigation(
  listener: (request: SystemSettingsNavigationRequest) => void,
) {
  function handleNavigation(event: Event) {
    const request = (event as CustomEvent<unknown>).detail
    if (isSystemSettingsNavigationRequest(request)) {
      listener(request)
    }
  }

  window.addEventListener(systemSettingsNavigationEventName, handleNavigation)
  return () =>
    window.removeEventListener(
      systemSettingsNavigationEventName,
      handleNavigation,
    )
}

function isSystemSettingsNavigationRequest(
  value: unknown,
): value is SystemSettingsNavigationRequest {
  if (!value || typeof value !== 'object') return false

  const request = value as Partial<SystemSettingsNavigationRequest>
  return (
    typeof request.requestId === 'string' &&
    systemSettingsTabIds.some((tab) => tab === request.tab) &&
    (request.targetId === null || typeof request.targetId === 'string')
  )
}
