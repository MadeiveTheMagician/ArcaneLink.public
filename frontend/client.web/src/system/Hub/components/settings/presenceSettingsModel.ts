import type {
  PresenceMode,
  PresenceVisibility
} from '../../../../shared/types';
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings';
import {
  isCanonicalPresenceVisibility,
  normalizePresenceVisibility
} from './presenceVisibilityModel';

export type PresenceSettingsDraft = {
  presenceVisibility: PresenceVisibility;
  showLastSeen: boolean;
  presenceMode: PresenceMode;
};

export type UpdatePresenceSettingsRequest = PresenceSettingsDraft;

export const defaultPresenceSettings: PresenceSettingsDraft = {
  presenceVisibility: 'everyone',
  showLastSeen: true,
  presenceMode: 'automatic'
};

const presenceModes = new Set<PresenceMode>(['automatic', 'invisible']);

export function toPresenceSettingsDraft(
  settings: Partial<PresenceSettingsDraft>
): PresenceSettingsDraft {
  return {
    presenceVisibility: normalizePresenceVisibility(
      settings.presenceVisibility
    ),
    showLastSeen:
      typeof settings.showLastSeen === 'boolean'
        ? settings.showLastSeen
        : defaultPresenceSettings.showLastSeen,
    presenceMode: isPresenceMode(settings.presenceMode)
      ? settings.presenceMode
      : defaultPresenceSettings.presenceMode
  };
}

export function isPresenceSettingsDraft(
  value: unknown
): value is PresenceSettingsDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Partial<PresenceSettingsDraft>;

  return (
    isPresenceVisibility(settings.presenceVisibility) &&
    typeof settings.showLastSeen === 'boolean' &&
    isPresenceMode(settings.presenceMode)
  );
}

export function buildPresenceSettingsRequest(
  draft: PresenceSettingsDraft
): UpdatePresenceSettingsRequest {
  if (!isPresenceSettingsDraft(draft)) {
    throw new Error('Invalid presence settings draft.');
  }

  return { ...draft };
}

export function mergePresenceSettings(
  settings: ProfileSettingsDraft,
  draft: PresenceSettingsDraft
): ProfileSettingsDraft {
  return {
    ...settings,
    ...buildPresenceSettingsRequest(draft)
  };
}

function isPresenceVisibility(value: unknown): value is PresenceVisibility {
  return isCanonicalPresenceVisibility(value);
}

function isPresenceMode(value: unknown): value is PresenceMode {
  return typeof value === 'string' && presenceModes.has(value as PresenceMode);
}
