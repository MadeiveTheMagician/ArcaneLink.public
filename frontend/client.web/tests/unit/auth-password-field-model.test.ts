import { expect, test } from '@playwright/test';

import { getAuthPasswordFieldPresentation } from '../../src/pages/Auth/fields/authPasswordFieldModel';

test.describe('auth password field presentation', () => {
  test('keeps the password masked before the visibility control is pressed', () => {
    expect(
      getAuthPasswordFieldPresentation({
        isVisible: false,
        fieldLabel: 'Пароль',
        showLabel: 'Показать пароль',
        hideLabel: 'Скрыть пароль'
      })
    ).toEqual({
      inputType: 'password',
      toggleIcon: 'eye',
      toggleLabel: 'Показать пароль: Пароль'
    });
  });

  test('reveals one explicitly named password field at a time', () => {
    expect(
      getAuthPasswordFieldPresentation({
        isVisible: true,
        fieldLabel: 'Повторите новый пароль',
        showLabel: 'Показать пароль',
        hideLabel: 'Скрыть пароль'
      })
    ).toEqual({
      inputType: 'text',
      toggleIcon: 'eye-off',
      toggleLabel: 'Скрыть пароль: Повторите новый пароль'
    });
  });
});
