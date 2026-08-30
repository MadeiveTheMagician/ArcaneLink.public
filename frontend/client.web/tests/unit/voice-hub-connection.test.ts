import { expect, test } from '@playwright/test';

import {
  configureVoiceConnectionTimeout,
  resolveVoiceReconnectDelayMs
} from '../../src/system/Server/hooks/voice/voiceHubConnection';

test.describe('voice hub reconnect policy', () => {
  test('keeps retrying with a capped delay after the initial backoff', () => {
    expect([0, 1, 2, 3, 4, 25].map(resolveVoiceReconnectDelayMs)).toEqual([
      0, 2_000, 10_000, 30_000, 30_000, 30_000
    ]);
  });

  test('detects a half-open voice connection within a bounded interval', () => {
    const connection = { serverTimeoutInMilliseconds: 0 } as Parameters<
      typeof configureVoiceConnectionTimeout
    >[0];

    configureVoiceConnectionTimeout(connection, 'server');
    expect(connection.serverTimeoutInMilliseconds).toBe(45_000);
    configureVoiceConnectionTimeout(connection, 'private');
    expect(connection.serverTimeoutInMilliseconds).toBe(45_000);
  });
});
