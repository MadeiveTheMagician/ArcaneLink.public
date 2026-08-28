import { apiJson } from '../api/api';
import type { UserResponse } from '../types';
import { streamingSettingsCopy } from './streamingSettings.copy.ts';

export type StreamingFrameRate = 15 | 30 | 60;
export type StreamingResolution =
  '480p' | '720p' | '1080p' | '1440p' | '4k' | 'source';
export type StreamingTier = 'free' | 'plus' | 'prime';

export type StreamingSettings = {
  frameRate: StreamingFrameRate;
  resolution: StreamingResolution;
};

type StreamingVideoConstraints = MediaTrackConstraints & {
  resizeMode?: string;
};

export type StreamingOption<TValue extends string | number> = {
  value: TValue;
  label: string;
  description: string;
  requiredTier: StreamingTier;
};

const streamingSettingsStorageKey = 'arcanelink.streamingSettings.v1';
export const streamingSettingsChangedEventName =
  'arcanelink:streaming-settings-changed';
let streamingConfigPromise: Promise<
  Partial<Record<StreamingResolution, number>>
> | null = null;

export const defaultStreamingSettings: StreamingSettings = {
  frameRate: 30,
  resolution: '720p'
};

export const streamingFrameRateOptions = [
  {
    value: 15,
    label: '15 FPS',
    description: streamingSettingsCopy.frameRates.fps15Description,
    requiredTier: 'free'
  },
  {
    value: 30,
    label: '30 FPS',
    description: streamingSettingsCopy.frameRates.fps30Description,
    requiredTier: 'free'
  },
  {
    value: 60,
    label: '60 FPS',
    description: streamingSettingsCopy.frameRates.fps60Description,
    requiredTier: 'free'
  }
] as const satisfies readonly StreamingOption<StreamingFrameRate>[];

export const streamingResolutionOptions = [
  {
    value: '480p',
    label: '480p',
    description: streamingSettingsCopy.resolutions.p480Description,
    requiredTier: 'free'
  },
  {
    value: '720p',
    label: '720p',
    description: streamingSettingsCopy.resolutions.p720Description,
    requiredTier: 'free'
  },
  {
    value: '1080p',
    label: '1080p',
    description: streamingSettingsCopy.resolutions.p1080Description,
    requiredTier: 'plus'
  },
  {
    value: '1440p',
    label: '1440p',
    description: streamingSettingsCopy.resolutions.p1440Description,
    requiredTier: 'plus'
  },
  {
    value: '4k',
    label: '4K',
    description: streamingSettingsCopy.resolutions.p4kDescription,
    requiredTier: 'prime'
  },
  {
    value: 'source',
    label: streamingSettingsCopy.resolutions.sourceLabel,
    description: streamingSettingsCopy.resolutions.sourceDescription,
    requiredTier: 'prime'
  }
] as const satisfies readonly StreamingOption<StreamingResolution>[];

const streamingResolutionDimensions: Record<
  Exclude<StreamingResolution, 'source'>,
  { width: number; height: number }
> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 }
};

export function loadStreamingSettings(): StreamingSettings {
  if (typeof window === 'undefined') {
    return defaultStreamingSettings;
  }

  try {
    return normalizeStreamingSettings(
      JSON.parse(
        window.localStorage.getItem(streamingSettingsStorageKey) ?? 'null'
      )
    );
  } catch {
    return defaultStreamingSettings;
  }
}

export function saveStreamingSettings(settings: StreamingSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedSettings = normalizeStreamingSettings(settings);

  window.localStorage.setItem(
    streamingSettingsStorageKey,
    JSON.stringify(normalizedSettings)
  );
  window.dispatchEvent(
    new CustomEvent<StreamingSettings>(streamingSettingsChangedEventName, {
      detail: normalizedSettings
    })
  );
}

export function normalizeStreamingSettings(value: unknown): StreamingSettings {
  if (!value || typeof value !== 'object') {
    return defaultStreamingSettings;
  }

  const candidate = value as Partial<StreamingSettings>;

  return {
    frameRate: isStreamingFrameRate(candidate.frameRate)
      ? candidate.frameRate
      : defaultStreamingSettings.frameRate,
    resolution: isStreamingResolution(candidate.resolution)
      ? candidate.resolution
      : defaultStreamingSettings.resolution
  };
}

export function resolveAllowedStreamingSettings(
  settings: StreamingSettings,
  user?: UserResponse | null
): StreamingSettings {
  const normalizedSettings = normalizeStreamingSettings(settings);

  if (
    isStreamingTierAllowed(
      getStreamingResolutionOption(normalizedSettings.resolution).requiredTier,
      user
    )
  ) {
    return normalizedSettings;
  }

  return {
    ...normalizedSettings,
    resolution: defaultStreamingSettings.resolution
  };
}

export function createStreamingVideoConstraints(
  settings = loadStreamingSettings()
): StreamingVideoConstraints {
  const normalizedSettings = normalizeStreamingSettings(settings);
  const baseConstraints: MediaTrackConstraints = {
    frameRate: {
      ideal: normalizedSettings.frameRate,
      max: normalizedSettings.frameRate
    }
  };

  if (normalizedSettings.resolution === 'source') {
    return baseConstraints;
  }

  const dimensions =
    streamingResolutionDimensions[normalizedSettings.resolution];

  return {
    ...baseConstraints,
    width: {
      ideal: dimensions.width,
      max: dimensions.width
    },
    height: {
      ideal: dimensions.height,
      max: dimensions.height
    },
    resizeMode: 'crop-and-scale'
  };
}

export async function getStreamingMaxBitrate(
  settings = loadStreamingSettings()
) {
  const normalizedSettings = normalizeStreamingSettings(settings);
  const config = await loadStreamingServerConfig();

  return config[normalizedSettings.resolution] ?? null;
}

export function isStreamingTierAllowed(
  requiredTier: StreamingTier,
  user?: UserResponse | null
) {
  if (requiredTier === 'free') {
    return true;
  }

  const tier = getUserStreamingTier(user);

  if (requiredTier === 'plus') {
    return tier === 'plus' || tier === 'prime';
  }

  return tier === 'prime';
}

export function getStreamingTierLabel(tier: StreamingTier) {
  if (tier === 'plus') {
    return 'Plus';
  }

  if (tier === 'prime') {
    return 'Prime';
  }

  return 'Free';
}

function getStreamingResolutionOption(resolution: StreamingResolution) {
  return (
    streamingResolutionOptions.find((option) => option.value === resolution) ??
    streamingResolutionOptions[1]
  );
}

async function loadStreamingServerConfig() {
  if (!streamingConfigPromise) {
    streamingConfigPromise = apiJson<{
      maxBitrateByResolution?: Partial<Record<StreamingResolution, number>>;
    }>('/api/streaming/config')
      .then((response) =>
        sanitizeStreamingBitrates(response.maxBitrateByResolution)
      )
      .catch(() => ({}));
  }

  return await streamingConfigPromise;
}

function sanitizeStreamingBitrates(
  values?: Partial<Record<StreamingResolution, number>>
) {
  const nextValues: Partial<Record<StreamingResolution, number>> = {};

  streamingResolutionOptions.forEach((option) => {
    const value = values?.[option.value];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      nextValues[option.value] = Math.round(value);
    }
  });

  return nextValues;
}

function getUserStreamingTier(user?: UserResponse | null): StreamingTier {
  const candidate = user as
    | (UserResponse & {
        subscriptionTypeCode?: string | null;
      })
    | null
    | undefined;
  const tier = (
    candidate?.subscriptionType?.code ??
    candidate?.subscriptionTypeCode ??
    'free'
  ).toLowerCase();

  if (tier === 'prime') {
    return 'prime';
  }

  if (tier === 'plus') {
    return 'plus';
  }

  return 'free';
}

function isStreamingFrameRate(value: unknown): value is StreamingFrameRate {
  return streamingFrameRateOptions.some((option) => option.value === value);
}

function isStreamingResolution(value: unknown): value is StreamingResolution {
  return streamingResolutionOptions.some((option) => option.value === value);
}
