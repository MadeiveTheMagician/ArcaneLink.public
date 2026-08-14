import { expect, test } from '@playwright/test'
import {
  createServerDirectoryRequest,
  getServerDirectoryVisibility,
  resolveServerDirectoryAccessAction,
  toggleExpandedServer,
} from '../../src/system/Server/components/navigation/serverDirectoryModel'

test.describe('server directory model', () => {
  test('builds a normalized discovery request', () => {
    const request = createServerDirectoryRequest({
      accessToken: 'token',
      query: '  arcane guild  ',
      sort: 'members',
      visibility: 'public',
    })

    expect(request.url).toBe(
      '/api/servers/discover?query=arcane+guild&visibility=public&sort=members',
    )
    expect(request.key).toBe(`token\u0000${request.url}`)
    expect(request.visibility).toBe('public')
  })

  test('keeps member overview separate from server discovery', () => {
    expect(getServerDirectoryVisibility('mine')).toBe('member')
    expect(getServerDirectoryVisibility('discover')).toBe('available')
  })

  test('opens memberships regardless of the discovery join hint', () => {
    expect(
      resolveServerDirectoryAccessAction({
        isMember: true,
        joinAction: 'none',
      }),
    ).toBe('open')
    expect(
      resolveServerDirectoryAccessAction({
        isMember: true,
        joinAction: 'request',
      }),
    ).toBe('open')
  })

  test('keeps public, restricted, pending, and unavailable actions distinct for outsiders', () => {
    expect(
      resolveServerDirectoryAccessAction({
        isMember: false,
        joinAction: 'join',
      }),
    ).toBe('join')
    expect(
      resolveServerDirectoryAccessAction({
        isMember: false,
        joinAction: 'request',
      }),
    ).toBe('request')
    expect(
      resolveServerDirectoryAccessAction({
        isMember: false,
        joinAction: 'pending',
      }),
    ).toBe('pending')
    expect(
      resolveServerDirectoryAccessAction({
        isMember: false,
        joinAction: 'none',
      }),
    ).toBe('none')
  })

  test('keeps several cards expanded independently', () => {
    const oneExpanded = toggleExpandedServer(new Set(), 'server-a')
    const twoExpanded = toggleExpandedServer(oneExpanded, 'server-b')
    const secondOnly = toggleExpandedServer(twoExpanded, 'server-a')

    expect([...oneExpanded]).toEqual(['server-a'])
    expect([...twoExpanded]).toEqual(['server-a', 'server-b'])
    expect([...secondOnly]).toEqual(['server-b'])
  })
})
