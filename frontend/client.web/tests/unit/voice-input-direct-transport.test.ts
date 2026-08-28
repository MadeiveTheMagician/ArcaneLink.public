import { expect, test } from '@playwright/test';

import {
  createDirectVoiceInputStream,
  isDirectVoiceInputStreamReady,
  setDirectVoiceInputGate,
  shouldUseDirectVoiceInputTransport
} from '../../src/system/Server/hooks/voice/voiceInputDirectTransport';

class FakeAudioTrack {
  readonly kind = 'audio';
  enabled = true;
  readyState: MediaStreamTrackState = 'live';
  contentHint = '';
  cloneCalls = 0;
  lastClone: FakeAudioTrack | null = null;

  clone() {
    this.cloneCalls += 1;
    this.lastClone = new FakeAudioTrack();
    return this.lastClone;
  }
}

class FakeMediaStream {
  constructor(private readonly tracks: FakeAudioTrack[] = []) {}

  getAudioTracks() {
    return this.tracks;
  }
}

test.describe('direct voice input transport', () => {
  test('uses a cloned microphone track and gates only the outbound clone', () => {
    const originalMediaStream = globalThis.MediaStream;
    Object.defineProperty(globalThis, 'MediaStream', {
      configurable: true,
      value: FakeMediaStream
    });

    try {
      const rawTrack = new FakeAudioTrack();
      const outboundStream = createDirectVoiceInputStream(
        rawTrack as unknown as MediaStreamTrack
      );
      const outboundTrack = rawTrack.lastClone;

      expect(rawTrack.cloneCalls).toBe(1);
      expect(outboundTrack).not.toBeNull();
      expect(outboundTrack).not.toBe(rawTrack);
      expect(outboundTrack?.contentHint).toBe('speech');
      expect(isDirectVoiceInputStreamReady(outboundStream)).toBe(true);

      setDirectVoiceInputGate(outboundStream, false);
      expect(outboundTrack?.enabled).toBe(false);
      expect(rawTrack.enabled).toBe(true);

      setDirectVoiceInputGate(outboundStream, true);
      expect(outboundTrack?.enabled).toBe(true);
      expect(rawTrack.enabled).toBe(true);

      setDirectVoiceInputGate(outboundStream, true, false);
      expect(outboundTrack?.enabled).toBe(false);
      expect(rawTrack.enabled).toBe(true);

      if (outboundTrack) {
        outboundTrack.readyState = 'ended';
      }
      expect(isDirectVoiceInputStreamReady(outboundStream)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'MediaStream', {
        configurable: true,
        value: originalMediaStream
      });
    }
  });

  test('bypasses WebAudio only when no browser processing is required', () => {
    expect(
      shouldUseDirectVoiceInputTransport({
        microphoneGainPercent: 100,
        noiseSuppressionMode: 'native'
      })
    ).toBe(true);
    expect(
      shouldUseDirectVoiceInputTransport({
        microphoneGainPercent: 100,
        noiseSuppressionMode: 'disabled'
      })
    ).toBe(true);
    expect(
      shouldUseDirectVoiceInputTransport({
        microphoneGainPercent: 100,
        noiseSuppressionMode: 'ml'
      })
    ).toBe(false);
    expect(
      shouldUseDirectVoiceInputTransport({
        microphoneGainPercent: 150,
        noiseSuppressionMode: 'native'
      })
    ).toBe(false);
  });
});
