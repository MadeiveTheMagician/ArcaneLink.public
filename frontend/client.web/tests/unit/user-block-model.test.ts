import { expect, test } from '@playwright/test';

import {
  getUserBlockedNotice,
  normalizeUserBlockComment,
  userBlockCommentMaxLength
} from '../../src/system/shared/components/user-blocking/userBlockModel';

test.describe('user block model', () => {
  test('normalizes an optional private comment', () => {
    expect(normalizeUserBlockComment('   ')).toBeNull();
    expect(normalizeUserBlockComment('  Спам в личных сообщениях  ')).toBe(
      'Спам в личных сообщениях'
    );
    expect(userBlockCommentMaxLength).toBe(128);
  });

  test('builds an informative notification with and without a comment', () => {
    expect(getUserBlockedNotice('Боба', null)).toContain(
      'Личные сообщения и приглашения'
    );
    expect(getUserBlockedNotice('Боба', 'Спам')).toBe(
      'Боба добавлен в чёрный список. Причина: Спам'
    );
  });
});
