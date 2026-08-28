import { expect, test } from '@playwright/test'

import { ApiError } from '../../src/shared/api/api'
import {
  clearAccountActionFromLocation,
  hasApiErrorCode,
  resolveAuthAccountAction,
} from '../../src/pages/Auth/account/accountActionModel'

test.describe('account action URL model', () => {
  test('accepts only supported actions with a non-empty token', () => {
    expect(
      resolveAuthAccountAction('?action=confirm-email&token=confirm-token'),
    ).toEqual({ kind: 'confirm-email', token: 'confirm-token' })
    expect(
      resolveAuthAccountAction('?action=reset-password&token=reset-token'),
    ).toEqual({ kind: 'reset-password', token: 'reset-token' })
    expect(
      resolveAuthAccountAction('', '#action=reset-password&token=fragment-token'),
    ).toEqual({ kind: 'reset-password', token: 'fragment-token' })
    expect(resolveAuthAccountAction('?action=confirm-email')).toBeNull()
    expect(resolveAuthAccountAction('?action=unknown&token=token')).toBeNull()
  })

  test('removes only sensitive action parameters from the browser URL', () => {
    const location = {
      href: 'https://arcane-link.ru/?action=confirm-email&token=secret&source=mail#done',
    } as Location

    expect(clearAccountActionFromLocation(location)).toBe('/?source=mail#done')

    const fragmentLocation = {
      href: 'https://arcane-link.ru/#action=reset-password&token=secret&source=mail',
    } as Location

    expect(clearAccountActionFromLocation(fragmentLocation)).toBe('/#source=mail')
  })

  test('recognizes the structured unconfirmed-email login error', () => {
    const error = new ApiError(
      'Confirm email',
      403,
      { errors: [{ code: 'email_not_confirmed', message: 'Confirm email' }] },
      '',
    )

    expect(hasApiErrorCode(error, 'email_not_confirmed')).toBe(true)
    expect(hasApiErrorCode(error, 'another_code')).toBe(false)
  })
})
