import type { CSSProperties } from 'react';

import { getProfileColor } from '../../../styles/systemThemes';
import type { ProfileSettingsDraft } from '../../Profile/hooks/useProfileSettings';

type BuildHubProfileStyleOptions = {
  profileSettings: ProfileSettingsDraft;
  hubPanelWidth: number;
  spacePanelWidth: number;
  memberPanelWidth: number;
};

export function buildHubProfileStyle({
  profileSettings,
  hubPanelWidth,
  spacePanelWidth,
  memberPanelWidth
}: BuildHubProfileStyleOptions) {
  return {
    '--profile-interface-scale': profileSettings.interfaceScale,
    '--profile-font-scale': profileSettings.fontScale,
    '--profile-server-scale': profileSettings.serverInterfaceScale,
    '--profile-accent-color': getProfileColor(
      profileSettings.selectedThemeCode,
      profileSettings.profileColor
    ),
    ...(profileSettings.profileBackgroundAssetId
      ? {
          '--theme-profile-bg-image': `url("/api/assets/${profileSettings.profileBackgroundAssetId}/content")`
        }
      : {}),
    '--profile-side-panel-width': `${hubPanelWidth}px`,
    '--profile-space-panel-width': `${spacePanelWidth}px`,
    '--profile-member-panel-width': `${memberPanelWidth}px`
  } as CSSProperties;
}
