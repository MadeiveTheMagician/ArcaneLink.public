import { expect, test } from '@playwright/test'
import { orderProfileTagsBySelection } from '../../src/system/Hub/components/settings/profileTagOrderModel'

test('selected profile tags are first without changing either group order', () => {
  const tags = [
    { id: 'a', code: 'a', title: 'A' },
    { id: 'b', code: 'b', title: 'B' },
    { id: 'c', code: 'c', title: 'C' },
    { id: 'd', code: 'd', title: 'D' },
  ]

  expect(orderProfileTagsBySelection(tags, ['d', 'b']).map((tag) => tag.id))
    .toEqual(['b', 'd', 'a', 'c'])
})
