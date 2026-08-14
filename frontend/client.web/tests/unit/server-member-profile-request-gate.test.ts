import { expect, test } from '@playwright/test'

import { ServerMemberProfileRequestGate } from '../../src/system/Hub/components/settings/serverMemberProfileRequestGate'

test.describe('server member profile request gate', () => {
  test('rejects a late response from the previously selected server', () => {
    const gate = new ServerMemberProfileRequestGate()
    const serverA = gate.begin('server-a')
    const serverB = gate.begin('server-b')

    expect(serverA.signal.aborted).toBe(true)
    expect(serverA.isCurrent('server-a')).toBe(false)
    expect(serverA.isCurrent('server-b')).toBe(false)
    expect(serverB.isCurrent('server-b')).toBe(true)
    expect(serverB.isCurrent('server-a')).toBe(false)
  })

  test('invalidates the active request when selection changes before reload', () => {
    const gate = new ServerMemberProfileRequestGate()
    const request = gate.begin('server-a')

    gate.cancel()

    expect(request.signal.aborted).toBe(true)
    expect(request.isCurrent('server-a')).toBe(false)
  })
})
