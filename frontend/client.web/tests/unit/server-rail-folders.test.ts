import { expect, test } from '@playwright/test'
import {
  applyServerRailDrop,
  defaultServerRailFolderColor,
  dissolveServerRailFolder,
  loadServerRailLayout,
  reconcileServerRailLayout,
  saveServerRailLayout,
  updateServerRailFolder,
} from '../../src/system/Server/components/navigation/serverRailFolders'
import type {
  ServerRailFolderEntry,
  ServerRailServerEntry,
} from '../../src/system/Server/components/navigation/serverRailFolders'

const server = (id: string): ServerRailServerEntry => ({ kind: 'server', id })
const folder = (id: string, serverIds: string[]): ServerRailFolderEntry => ({
  kind: 'folder',
  id,
  name: 'Friends',
  color: defaultServerRailFolderColor,
  serverIds,
})

test('seeds folders from existing server order and anchors new folders at the drop target', () => {
  const initial = reconcileServerRailLayout([], ['a', 'b', 'c', 'd'])
  expect(initial).toEqual([server('a'), server('b'), server('c'), server('d')])

  const grouped = applyServerRailDrop(
    initial,
    server('a'),
    { ...server('c'), placement: 'inside' },
    { id: 'group', name: 'Friends' },
  )

  expect(grouped).toEqual([server('b'), folder('group', ['c', 'a']), server('d')])
  expect(initial).toEqual([server('a'), server('b'), server('c'), server('d')])
})

test('moves servers between folders, reorders their children, and moves them out', () => {
  const first = folder('first', ['a', 'b'])
  const second = folder('second', ['c'])
  const initial = [first, second, server('d')]

  const movedIn = applyServerRailDrop(initial, server('b'), {
    kind: 'folder', id: 'second', placement: 'inside',
  })
  expect(movedIn).toEqual([folder('first', ['a']), folder('second', ['c', 'b']), server('d')])

  const reordered = applyServerRailDrop(movedIn, server('b'), {
    ...server('c'), placement: 'before',
  })
  expect(reordered).toEqual([folder('first', ['a']), folder('second', ['b', 'c']), server('d')])

  const movedOut = applyServerRailDrop(reordered, server('a'), {
    ...server('d'), placement: 'before',
  })
  expect(movedOut).toEqual([folder('second', ['b', 'c']), server('a'), server('d')])
})

test('moves a folder without nesting, and moving its only server out dissolves it', () => {
  const first = folder('first', ['a'])
  const second = folder('second', ['b'])
  const initial = [first, server('c'), second]

  expect(applyServerRailDrop(initial, first, { kind: 'folder', id: 'second', placement: 'inside' })).toBe(initial)
  expect(applyServerRailDrop(initial, first, { ...server('a'), placement: 'after' })).toBe(initial)
  expect(applyServerRailDrop(initial, first, { kind: 'end' })).toEqual([server('c'), second, first])
  expect(applyServerRailDrop(initial, server('a'), { kind: 'folder', id: 'first', placement: 'before' })).toEqual([
    server('a'), server('c'), second,
  ])
})

test('reconciles stale and duplicate memberships without losing folder settings', () => {
  const first = folder('first', ['a', 'removed', 'b'])
  const initial = [first, server('b'), folder('removed', ['removed']), server('c')]
  const visible = reconcileServerRailLayout(initial, ['new', 'b', 'b', 'c'])

  expect(visible).toEqual([folder('first', ['b']), server('c'), server('new')])
  expect(reconcileServerRailLayout(visible, ['c', 'new', 'b'])).toBe(visible)
  expect(reconcileServerRailLayout(initial, [])).toEqual([])
  expect(initial[0]).toBe(first)
  expect(first.serverIds).toEqual(['a', 'removed', 'b'])
})

test('renames and recolors a folder, and dissolving it keeps the order of its servers', () => {
  const initial = [server('c'), folder('first', ['b', 'a']), server('d')]
  const updated = updateServerRailFolder(initial, 'first', { name: ' Project ', color: '#BD1234' })

  expect(updated[1]).toEqual({ ...folder('first', ['b', 'a']), name: 'Project', color: '#bd1234' })
  expect(updateServerRailFolder(updated, 'first', { name: ' ', color: 'url(invalid)' })).toBe(updated)
  expect(dissolveServerRailFolder(updated, 'first')).toEqual([
    server('c'), server('b'), server('a'), server('d'),
  ])
})

test('persists each account independently and tolerates invalid saved entries', () => {
  const saved = new Map<string, string>()
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value) },
  }
  const layout = [folder('project', ['a', 'b']), server('c')]

  saveServerRailLayout('account-a', layout, storage)
  saveServerRailLayout('account-b', [server('d')], storage)
  expect(loadServerRailLayout(' ACCOUNT-A ', storage)).toEqual(layout)
  expect(loadServerRailLayout('account-b', storage)).toEqual([server('d')])

  const key = 'arcanelink.serverRailLayout.v1.account-a'
  saved.set(key, JSON.stringify([
    null,
    { ...folder('project', ['a', 'a']), color: 'invalid', unexpected: true },
    server('a'),
    server('c'),
  ]))
  expect(loadServerRailLayout('account-a', storage)).toEqual([folder('project', ['a']), server('c')])

  saved.set(key, 'malformed')
  expect(loadServerRailLayout('account-a', storage)).toEqual([])
})
