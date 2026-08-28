export const voiceInputLevelEventName = 'arcanelink:voice-input-level';

export type VoiceInputLevelDetail = {
  levelDb: number;
  normalizedLevel: number;
  thresholdDb: number;
  isSpeaking: boolean;
  isTrackLive: boolean;
};

export type VoiceInputLevelListener = (detail: VoiceInputLevelDetail) => void;

export function publishVoiceInputLevel(detail: VoiceInputLevelDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<VoiceInputLevelDetail>(voiceInputLevelEventName, {
      detail
    })
  );
}

export function subscribeVoiceInputLevel(listener: VoiceInputLevelListener) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleLevel = (event: Event) => {
    const detail = (event as CustomEvent<VoiceInputLevelDetail>).detail;
    if (detail) {
      listener(detail);
    }
  };

  window.addEventListener(voiceInputLevelEventName, handleLevel);
  return () => {
    window.removeEventListener(voiceInputLevelEventName, handleLevel);
  };
}
