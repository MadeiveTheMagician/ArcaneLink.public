import { expect, test } from '@playwright/test'
import {
  clearSentMessageDraft, emptyMessageDraft, messageDraftKey, readMessageDraft, writeMessageDraft,
} from '../../src/system/Server/components/messages/messageDraftStorage'

test.beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
})

test('keeps drafts and valid mentions separate by user and feed', () => {
  const draft = { ...emptyMessageDraft(), text: 'Hi @Alice', mentions: [
    { kind: 'user' as const, targetId: 'alice', token: '@Alice', start: 3, length: 6 },
  ] }
  writeMessageDraft('one', 'chat', draft)
  expect(readMessageDraft('one', 'chat')).toEqual(draft)
  expect(readMessageDraft('two', 'chat')).toEqual(emptyMessageDraft())
  expect(readMessageDraft('one', 'other')).toEqual(emptyMessageDraft())
})

test('ignores broken, expired and incompatible storage', () => {
  const key = messageDraftKey('one', 'chat')
  for (const raw of ['{', 'null', JSON.stringify({ version: 2, text: 'old', mentions: [], updatedAt: Date.now() }),
    JSON.stringify({ version: 1, text: 'old', mentions: [], updatedAt: 0 })]) {
    localStorage.setItem(key, raw)
    expect(readMessageDraft('one', 'chat')).toEqual(emptyMessageDraft())
  }
})

test('filters malformed mention ranges without losing text', () => {
  localStorage.setItem(messageDraftKey('one', 'chat'), JSON.stringify({
    version: 1, updatedAt: Date.now(), text: '@Alice', mentions: [null, { kind: 'user' },
      { kind: 'user', targetId: 'alice', token: '@Alice', start: 10, length: 6 }],
    replyTarget: { id: 'old', senderUserId: 'alice', senderDisplayName: 'Alice', body: 'hello', createdAt: 'broken' },
  }))
  expect(readMessageDraft('one', 'chat')).toEqual({ ...emptyMessageDraft(), text: '@Alice' })
})

test('late send completion clears its own draft but preserves a newer draft', () => {
  const submitted = { ...emptyMessageDraft(), text: 'first' }
  const newer = { ...emptyMessageDraft(), text: 'second' }
  writeMessageDraft('one', 'chat', submitted)
  clearSentMessageDraft('one', 'chat', submitted)
  expect(readMessageDraft('one', 'chat')).toEqual(emptyMessageDraft())
  writeMessageDraft('one', 'chat', newer)
  clearSentMessageDraft('one', 'chat', submitted)
  expect(readMessageDraft('one', 'chat')).toEqual(newer)
})

test('disabled storage does not break composing', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked') } })
  expect(() => writeMessageDraft('one', 'chat', { ...emptyMessageDraft(), text: 'hello' })).not.toThrow()
  expect(readMessageDraft('one', 'chat')).toEqual(emptyMessageDraft())
})
