export const voicePlaybackUnlockEventName = 'arcanelink:voice-playback-unlock';

type VoicePlaybackEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'dispatchEvent' | 'removeEventListener'
>;

function getVoicePlaybackEventTarget(): VoicePlaybackEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

export function requestVoicePlaybackUnlock(
  target = getVoicePlaybackEventTarget()
) {
  target?.dispatchEvent(new Event(voicePlaybackUnlockEventName));
}

export function subscribeVoicePlaybackUnlock(
  listener: () => void,
  target = getVoicePlaybackEventTarget()
) {
  if (!target) return () => undefined;
  target.addEventListener(voicePlaybackUnlockEventName, listener);
  return () =>
    target.removeEventListener(voicePlaybackUnlockEventName, listener);
}
