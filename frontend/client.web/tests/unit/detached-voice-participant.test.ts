import { expect, test } from '@playwright/test'

import {
  getVisibleDetachedVoiceCards,
  selectDetachedParticipantCard,
} from '../../src/system/Server/components/voice/detached/detachedVoiceCardVisibility'
import { disposeAndCloseDetachedVoiceWorkspaceWindow } from '../../src/system/Server/components/voice/detached/detachedVoiceWindowLifecycle'
import type { VoiceParticipantCard } from '../../src/system/Server/components/voice/detached/detachedVoiceWorkspaceTypes'

function createCard(
  mediaKind: 'camera' | 'screen',
  patch: Partial<VoiceParticipantCard> = {},
): VoiceParticipantCard {
  return {
    hasVideo: true,
    isSelf: false,
    isSpeaking: false,
    accent: '139, 94, 255',
    mediaKind,
    normalizedParticipantId: `participant-1:${mediaKind}`,
    participant: {
      participantId: 'participant-1',
      userId: 'user-1',
      login: 'user',
      displayName: 'User',
      isMuted: false,
      isDeafened: false,
      isCameraEnabled: true,
      isScreenSharing: mediaKind === 'screen',
      joinedAt: '',
    },
    participantMember: undefined,
    participantStream: null,
    status: '',
    ...patch,
  }
}

test('participant popup selects one camera card instead of a full workspace', () => {
  const camera = createCard('camera')
  const screen = createCard('screen')

  expect(selectDetachedParticipantCard([screen, camera])).toBe(camera)
  expect(selectDetachedParticipantCard([screen])).toBe(screen)
})

test('detached workspace hides only the local camera when configured', () => {
  const localCamera = createCard('camera', { isSelf: true })
  const localScreen = createCard('screen', { isSelf: true })
  const remoteCamera = createCard('camera')

  expect(
    getVisibleDetachedVoiceCards(
      [localCamera, localScreen, remoteCamera],
      true,
      false,
    ),
  ).toEqual([localScreen, remoteCamera])
})

test('detached window is disposed before it is closed', () => {
  const lifecycle: string[] = []
  const popup = {
    closed: false,
    disposeVoiceWorkspaceRuntime: () => lifecycle.push('dispose'),
    close: () => lifecycle.push('close'),
  } as unknown as NonNullable<
    Parameters<typeof disposeAndCloseDetachedVoiceWorkspaceWindow>[0]
  >

  disposeAndCloseDetachedVoiceWorkspaceWindow(popup)

  expect(lifecycle).toEqual(['dispose', 'close'])
})

test('already closed detached window is not touched again', () => {
  let calls = 0
  const popup = {
    closed: true,
    disposeVoiceWorkspaceRuntime: () => calls += 1,
    close: () => calls += 1,
  } as unknown as NonNullable<
    Parameters<typeof disposeAndCloseDetachedVoiceWorkspaceWindow>[0]
  >

  disposeAndCloseDetachedVoiceWorkspaceWindow(popup)

  expect(calls).toBe(0)
})
