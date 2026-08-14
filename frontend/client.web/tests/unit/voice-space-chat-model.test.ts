import { expect, test } from '@playwright/test'

import type { SpaceResponse } from '../../src/shared/types'
import {
  getActiveMessageSpaceId,
  getVoiceChatSpaceIdAfterSelection,
  isVoiceSpaceChatOpen,
  toggleVoiceChatSpaceId,
} from '../../src/system/Server/components/voice/chat/voiceSpaceChatModel'

const voiceChannel = {
  type: 'channel',
  kind: 'voice',
  spaceId: 'voice-1',
  title: 'Voice',
} as const

const voiceSpace = {
  id: 'voice-1',
  typeCode: 'voice_room',
  voiceChatSpaceId: 'voice-chat-1',
} as SpaceResponse

test('voice messages use the companion text space only while chat is open', () => {
  expect(getActiveMessageSpaceId(voiceChannel, voiceSpace, null)).toBeNull()
  expect(
    getActiveMessageSpaceId(voiceChannel, voiceSpace, 'voice-1'),
  ).toBe('voice-chat-1')
  expect(isVoiceSpaceChatOpen(voiceChannel, null)).toBe(false)
})

test('cloud action opens chat only for a voice space', () => {
  expect(
    getVoiceChatSpaceIdAfterSelection(voiceSpace, true),
  ).toBe('voice-1')
  expect(toggleVoiceChatSpaceId('voice-1', voiceSpace)).toBeNull()
  expect(toggleVoiceChatSpaceId(null, voiceSpace)).toBe('voice-1')
  expect(
    getVoiceChatSpaceIdAfterSelection(
      { id: 'text-1', typeCode: 'text_room' } as SpaceResponse,
      true,
    ),
  ).toBeNull()
  expect(
    getVoiceChatSpaceIdAfterSelection(
      {
        id: 'voice-without-chat',
        typeCode: 'voice_room',
        voiceChatSpaceId: null,
      } as SpaceResponse,
      true,
    ),
  ).toBeNull()
})

test('text channels keep their own message space id', () => {
  const textChannel = {
    ...voiceChannel,
    kind: 'text',
    spaceId: 'text-1',
  } as const
  const textSpace = {
    id: 'text-1',
    typeCode: 'text_room',
    voiceChatSpaceId: null,
  } as SpaceResponse

  expect(getActiveMessageSpaceId(textChannel, textSpace, null)).toBe('text-1')
})

test('voice chat is scoped to the currently visible voice space', () => {
  expect(isVoiceSpaceChatOpen(voiceChannel, 'voice-1')).toBe(true)
  expect(isVoiceSpaceChatOpen(voiceChannel, 'voice-2')).toBe(false)
  expect(
    isVoiceSpaceChatOpen(
      { ...voiceChannel, kind: 'text' },
      'voice-1',
    ),
  ).toBe(false)
})
