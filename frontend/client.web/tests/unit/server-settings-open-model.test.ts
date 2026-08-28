import { expect, test } from '@playwright/test'
import type { ServerMemberResponse } from '../../src/shared/types'
import { openServerSettingsForMembership } from '../../src/system/Hub/utils/serverSettingsOpenModel'

const membership = {
  serverId: 'server-2',
} as ServerMemberResponse

test.describe('server settings open sequencing', () => {
  test('selects a context-target server before opening settings', async () => {
    const events: string[] = []

    const opened = await openServerSettingsForMembership({
      membership,
      selectedServerId: 'server-1',
      selectServer: async () => {
        events.push('select:start')
        await Promise.resolve()
        events.push('select:done')
      },
      openSettings: () => events.push('settings:open'),
    })

    expect(opened).toBe(true)
    expect(events).toEqual(['select:start', 'select:done', 'settings:open'])
  })

  test('does not open settings when selecting the context target fails', async () => {
    let settingsOpenCount = 0

    const opened = await openServerSettingsForMembership({
      membership,
      selectedServerId: 'server-1',
      selectServer: async () => {
        throw new Error('member load failed')
      },
      openSettings: () => {
        settingsOpenCount += 1
      },
    })

    expect(opened).toBe(false)
    expect(settingsOpenCount).toBe(0)
  })

  test('opens immediately when the context target is already selected', async () => {
    let selectCount = 0
    let settingsOpenCount = 0

    const opened = await openServerSettingsForMembership({
      membership,
      selectedServerId: membership.serverId,
      selectServer: async () => {
        selectCount += 1
      },
      openSettings: () => {
        settingsOpenCount += 1
      },
    })

    expect(opened).toBe(true)
    expect(selectCount).toBe(0)
    expect(settingsOpenCount).toBe(1)
  })
})
