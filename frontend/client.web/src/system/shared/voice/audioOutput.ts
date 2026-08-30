export const defaultAudioOutputDeviceId = '';

export type AudioOutputDeviceLike = {
  deviceId: string;
};

export type AudioOutputSelection = {
  deviceId: string;
  didFallback: boolean;
};

export type AudioOutputSettingsLike = {
  outputDeviceId: string;
  outputVolumePercent: number;
};

export type AudioOutputTestOptions = AudioOutputSettingsLike & {
  durationMs?: number;
};

export type AudioOutputDeviceRequestResult =
  | {
      status: 'selected';
      device: MediaDeviceInfo;
    }
  | {
      status: 'unsupported' | 'denied' | 'unavailable';
      device: null;
    };

type AudioElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type AudioOutputRoutingCapability = {
  setSinkId?: unknown;
};

type MediaDevicesWithAudioOutputSelection = {
  selectAudioOutput?: (options?: {
    deviceId?: string;
  }) => Promise<MediaDeviceInfo>;
};

export function clampAudioOutputVolumePercent(volumePercent: number) {
  if (!Number.isFinite(volumePercent)) {
    return 100;
  }

  return Math.min(100, Math.max(0, volumePercent));
}

export function combineVoicePlaybackVolume(
  outputVolumePercent: number,
  participantVolume: number,
  isMuted = false
) {
  if (isMuted) {
    return 0;
  }

  const globalVolume = clampAudioOutputVolumePercent(outputVolumePercent) / 100;
  const normalizedParticipantVolume = Number.isFinite(participantVolume)
    ? Math.min(1, Math.max(0, participantVolume))
    : 1;

  return globalVolume * normalizedParticipantVolume;
}

export function resolveAudioOutputDeviceId(
  preferredDeviceId: string | null | undefined,
  availableDevices: readonly AudioOutputDeviceLike[]
): AudioOutputSelection {
  const normalizedDeviceId = normalizeAudioOutputDeviceId(preferredDeviceId);

  if (normalizedDeviceId === defaultAudioOutputDeviceId) {
    return {
      deviceId: defaultAudioOutputDeviceId,
      didFallback: false
    };
  }

  const preferredDeviceIsAvailable = availableDevices.some(
    (device) => device.deviceId === normalizedDeviceId
  );

  return preferredDeviceIsAvailable
    ? {
        deviceId: normalizedDeviceId,
        didFallback: false
      }
    : {
        deviceId: defaultAudioOutputDeviceId,
        didFallback: true
      };
}

export function isDefaultAudioOutputDeviceId(
  deviceId: string | null | undefined
) {
  return normalizeAudioOutputDeviceId(deviceId) === defaultAudioOutputDeviceId;
}

export function supportsAudioOutputRouting(
  audio?: AudioOutputRoutingCapability | null
): boolean {
  const candidate =
    audio === undefined
      ? typeof document === 'undefined'
        ? null
        : (document.createElement('audio') as AudioOutputRoutingCapability)
      : audio;

  return typeof candidate?.setSinkId === 'function';
}

export function supportsAudioOutputPrompt(
  mediaDevices?: MediaDevicesWithAudioOutputSelection | null
): boolean {
  const candidate =
    mediaDevices === undefined
      ? typeof navigator === 'undefined'
        ? null
        : (navigator.mediaDevices as MediaDevicesWithAudioOutputSelection)
      : mediaDevices;

  return typeof candidate?.selectAudioOutput === 'function';
}

function canRouteAudioElement(
  audio: HTMLAudioElement
): audio is AudioElementWithSinkId & {
  setSinkId: (sinkId: string) => Promise<void>;
} {
  return supportsAudioOutputRouting(audio);
}

export async function applyAudioOutputDevice(
  audio: HTMLAudioElement,
  preferredDeviceId: string | null | undefined,
  availableDevices: readonly AudioOutputDeviceLike[] = []
): Promise<AudioOutputSelection> {
  const selection = resolveAudioOutputDeviceId(
    preferredDeviceId,
    availableDevices
  );

  if (!canRouteAudioElement(audio)) {
    return {
      deviceId: defaultAudioOutputDeviceId,
      didFallback:
        selection.didFallback ||
        selection.deviceId !== defaultAudioOutputDeviceId
    };
  }

  try {
    await audio.setSinkId(selection.deviceId);
    return selection;
  } catch {
    if (selection.deviceId === defaultAudioOutputDeviceId) {
      return selection;
    }

    try {
      await audio.setSinkId(defaultAudioOutputDeviceId);
    } catch {
      // Playback can still continue through the browser's current default sink.
    }

    return {
      deviceId: defaultAudioOutputDeviceId,
      didFallback: true
    };
  }
}

export async function listAvailableAudioOutputDevices() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audiooutput');
  } catch {
    return [];
  }
}

export async function requestAudioOutputDevice(
  preferredDeviceId?: string | null
): Promise<AudioOutputDeviceRequestResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return {
      status: 'unsupported',
      device: null
    };
  }

  const mediaDevices =
    navigator.mediaDevices as MediaDevicesWithAudioOutputSelection;
  if (!supportsAudioOutputPrompt(mediaDevices)) {
    return {
      status: 'unsupported',
      device: null
    };
  }

  try {
    const normalizedDeviceId = normalizeAudioOutputDeviceId(preferredDeviceId);
    const device = await mediaDevices.selectAudioOutput?.(
      normalizedDeviceId ? { deviceId: normalizedDeviceId } : undefined
    );
    if (!device) {
      return {
        status: 'unavailable',
        device: null
      };
    }
    return {
      status: 'selected',
      device
    };
  } catch (error) {
    return {
      status:
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'denied'
          : 'unavailable',
      device: null
    };
  }
}

export function subscribeAudioOutputDeviceChanges(
  listener: (devices: MediaDeviceInfo[]) => void
) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    listener([]);
    return () => undefined;
  }

  let disposed = false;

  const publishDevices = async () => {
    const devices = await listAvailableAudioOutputDevices();
    if (!disposed) {
      listener(devices);
    }
  };

  const handleDeviceChange = () => {
    void publishDevices();
  };

  navigator.mediaDevices.addEventListener?.('devicechange', handleDeviceChange);
  void publishDevices();

  return () => {
    disposed = true;
    navigator.mediaDevices.removeEventListener?.(
      'devicechange',
      handleDeviceChange
    );
  };
}

export async function playAudioOutputTest({
  outputDeviceId,
  outputVolumePercent,
  durationMs = 850
}: AudioOutputTestOptions) {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof AudioContext === 'undefined'
  ) {
    throw new Error('Audio output testing is unavailable in this environment.');
  }

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();
  const audio = document.createElement('audio');
  const devices = await listAvailableAudioOutputDevices();

  oscillator.type = 'sine';
  oscillator.frequency.value = 523.25;
  audio.setAttribute('playsinline', '');
  audio.volume = combineVoicePlaybackVolume(outputVolumePercent, 1);
  audio.srcObject = destination.stream;

  oscillator.connect(envelope);
  envelope.connect(destination);

  const now = audioContext.currentTime;
  const normalizedDurationMs = Number.isFinite(durationMs)
    ? Math.max(150, durationMs)
    : 850;
  const durationSeconds = normalizedDurationMs / 1000;
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
  envelope.gain.setValueAtTime(
    0.35,
    now + Math.max(0.05, durationSeconds - 0.08)
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  try {
    const selection = await applyAudioOutputDevice(
      audio,
      outputDeviceId,
      devices
    );
    await audioContext.resume();
    await audio.play();
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
    await waitForOscillatorEnd(oscillator);
    return selection;
  } finally {
    audio.pause();
    audio.srcObject = null;
    oscillator.disconnect();
    envelope.disconnect();
    destination.disconnect();
    await audioContext.close();
  }
}

function normalizeAudioOutputDeviceId(deviceId: string | null | undefined) {
  const normalizedDeviceId = deviceId?.trim() ?? '';
  return normalizedDeviceId === 'default'
    ? defaultAudioOutputDeviceId
    : normalizedDeviceId;
}

function waitForOscillatorEnd(oscillator: OscillatorNode) {
  return new Promise<void>((resolve) => {
    oscillator.addEventListener('ended', () => resolve(), { once: true });
  });
}
