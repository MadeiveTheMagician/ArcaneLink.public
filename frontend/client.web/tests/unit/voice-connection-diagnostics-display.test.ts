import { expect, test } from '@playwright/test';

import { formatVoiceCodecLabel } from '../../src/system/Hub/components/voice/voiceConnectionDiagnosticsDisplay';

test.describe('voice connection diagnostics display', () => {
  test('localizes WebRTC codec units without changing the codec name', () => {
    expect(formatVoiceCodecLabel('Opus · 48 kHz · 2 ch')).toBe(
      'Opus · 48 кГц · 2 кан.'
    );
  });

  test('normalizes the legacy separator and keeps partial metadata useful', () => {
    expect(formatVoiceCodecLabel('Opus В· 48 kHz')).toBe('Opus · 48 кГц');
    expect(formatVoiceCodecLabel('Opus')).toBe('Opus');
    expect(formatVoiceCodecLabel('   ')).toBeNull();
  });
});
