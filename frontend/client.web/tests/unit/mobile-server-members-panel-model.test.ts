import { expect, test } from '@playwright/test'
import { isMobileMembersPanelOpen } from '../../src/system/Server/components/channel-tree/mobileServerMembersPanelModel'

test.describe('mobile server members panel model', () => {
  test('opens members only while the members tab is active on a mobile viewport', () => {
    expect(isMobileMembersPanelOpen(true, 'members')).toBe(true)
    expect(isMobileMembersPanelOpen(true, 'spaces')).toBe(false)
  })

  test('releases the server navigation when the viewport becomes desktop', () => {
    expect(isMobileMembersPanelOpen(false, 'members')).toBe(false)
  })
})
