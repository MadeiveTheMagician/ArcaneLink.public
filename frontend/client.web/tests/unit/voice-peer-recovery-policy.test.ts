import { expect, test } from '@playwright/test';

import { resolveVoicePeerRecoveryDelayMs } from '../../src/system/Server/hooks/voice/voicePeerRecoveryModel';

test.describe('voice peer recovery policy', () => {
  test('gives transient disconnects a grace period and retries failed recovery', () => {
    expect(resolveVoicePeerRecoveryDelayMs('disconnected', false)).toBe(8_000);
    expect(resolveVoicePeerRecoveryDelayMs('disconnected', true)).toBe(10_000);
    expect(resolveVoicePeerRecoveryDelayMs('failed', false)).toBe(0);
    expect(resolveVoicePeerRecoveryDelayMs('failed', true)).toBe(10_000);
  });

  test('does not recover healthy or intentionally closed peers', () => {
    expect(resolveVoicePeerRecoveryDelayMs('connected', false)).toBeNull();
    expect(resolveVoicePeerRecoveryDelayMs('connecting', false)).toBeNull();
    expect(resolveVoicePeerRecoveryDelayMs('closed', true)).toBeNull();
  });

  test('recovers mobile route changes reported only by ICE state', () => {
    expect(
      resolveVoicePeerRecoveryDelayMs('connected', false, 'disconnected')
    ).toBe(8_000);
    expect(resolveVoicePeerRecoveryDelayMs('connected', false, 'failed')).toBe(
      0
    );
    expect(
      resolveVoicePeerRecoveryDelayMs('connected', false, 'connected')
    ).toBeNull();
    expect(
      resolveVoicePeerRecoveryDelayMs('connected', true, 'completed')
    ).toBeNull();
  });
});
