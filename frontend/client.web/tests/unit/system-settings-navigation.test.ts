import { expect, test } from '@playwright/test'
import {
  createSystemSettingsNavigationRequest,
  dangerousFilesWarningSettingsTargetId,
  resolveSystemSettingsInitialTab,
  voiceDiagnosticsSettingsTargetId,
} from '../../src/system/shared/navigation/systemSettingsNavigation'

test('routes the dangerous-file warning to its security setting', () => {
  expect(
    createSystemSettingsNavigationRequest(
      'dangerous-files-warning',
      'request-1',
    ),
  ).toEqual({
    requestId: 'request-1',
    tab: 'security',
    targetId: dangerousFilesWarningSettingsTargetId,
  })
})

test('uses the account tab for ordinary settings openings', () => {
  expect(resolveSystemSettingsInitialTab(null)).toBe('account')
  expect(
    resolveSystemSettingsInitialTab(
      createSystemSettingsNavigationRequest(
        'dangerous-files-warning',
        'request-2',
      ),
    ),
  ).toBe('security')
})

test('routes voice diagnostics to the voice settings section', () => {
  const request = createSystemSettingsNavigationRequest(
    'voice-diagnostics',
    'request-voice',
  )

  expect(request).toEqual({
    requestId: 'request-voice',
    tab: 'voice',
    targetId: voiceDiagnosticsSettingsTargetId,
  })
  expect(resolveSystemSettingsInitialTab(request)).toBe('voice')
})
