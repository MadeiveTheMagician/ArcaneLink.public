import { expect, test } from '@playwright/test'
import { resolveVoiceCallControlPresentation } from '../../src/system/Server/components/voice/controls/voiceCallControlPresentation'
import { getDetachedControlIconCss } from '../../src/system/Server/components/voice/detached/detachedVoiceIcons'

const inactiveState = {
  isMuted: true,
  isDeafened: true,
  isCameraEnabled: false,
  isScreenSharing: false,
}

test('main voice controls expose distinct on and off icons', () => {
  expect(
    resolveVoiceCallControlPresentation('isMuted', inactiveState).icon,
  ).toBe('mic-off')
  expect(
    resolveVoiceCallControlPresentation('isDeafened', inactiveState).icon,
  ).toBe('headphones-off')
  expect(
    resolveVoiceCallControlPresentation('isCameraEnabled', inactiveState).icon,
  ).toBe('camera-off')
  expect(
    resolveVoiceCallControlPresentation('isScreenSharing', inactiveState).icon,
  ).toBe('screen-off')

  const activeState = {
    isMuted: false,
    isDeafened: false,
    isCameraEnabled: true,
    isScreenSharing: true,
  }
  expect(
    resolveVoiceCallControlPresentation('isMuted', activeState).icon,
  ).toBe('mic-on')
  expect(
    resolveVoiceCallControlPresentation('isDeafened', activeState).icon,
  ).toBe('headphones-on')
  expect(
    resolveVoiceCallControlPresentation('isCameraEnabled', activeState).icon,
  ).toBe('camera')
  expect(
    resolveVoiceCallControlPresentation('isScreenSharing', activeState).icon,
  ).toBe('screen')
})

test('detached voice controls use the same state-specific icon variants', () => {
  for (const control of ['mic', 'headphones', 'camera', 'screen'] as const) {
    expect(getDetachedControlIconCss(control, false)).not.toBe(
      getDetachedControlIconCss(control, true),
    )
  }
})
