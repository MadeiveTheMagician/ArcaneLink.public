import { expect, test } from '@playwright/test';

import { resolveAppEntryRoute } from '../../src/appEntryRoute';

test.describe('application entry route', () => {
  test('opens the API test console only for its exact development path', () => {
    expect(resolveAppEntryRoute('/api-test', true)).toBe('api-test');
    expect(resolveAppEntryRoute('/api-test/', true)).toBe('app');
    expect(resolveAppEntryRoute('/api-test/anything', true)).toBe('app');
  });

  test('always opens the application in a production build', () => {
    expect(resolveAppEntryRoute('/api-test', false)).toBe('app');
    expect(resolveAppEntryRoute('/', false)).toBe('app');
  });
});
