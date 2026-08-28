import { expect, test } from '@playwright/test'
import { getServerMembersPanelDisclosure } from '../../src/system/Server/components/members/serverMembersPanelModel'

test.describe('server members panel disclosure model', () => {
  test('keeps an expanded panel interactive and exposed to assistive technology', () => {
    expect(getServerMembersPanelDisclosure(false)).toEqual({
      ariaHidden: false,
      inert: false,
      state: 'expanded',
      toggleExpanded: true,
      toggleLabel: 'Скрыть участников',
    })
  })

  test('makes a collapsed but mounted panel inert and hidden from accessibility APIs', () => {
    expect(getServerMembersPanelDisclosure(true)).toEqual({
      ariaHidden: true,
      inert: true,
      state: 'collapsed',
      toggleExpanded: false,
      toggleLabel: 'Показать участников',
    })
  })
})
