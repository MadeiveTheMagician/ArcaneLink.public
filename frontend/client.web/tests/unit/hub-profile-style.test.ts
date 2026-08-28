import { expect, test } from '@playwright/test';

import { buildHubProfileStyle } from '../../src/system/Hub/utils/hubProfileStyle';
import type { ProfileSettingsDraft } from '../../src/system/Profile/hooks/useProfileSettings';

const defaultSettings: ProfileSettingsDraft = {
  interfaceScale: 1,
  fontScale: 1,
  serverInterfaceScale: 1,
  isServerRailPinned: false,
  showPrivateReadAllButton: true,
  serverMessageDisplayFormat: 'wall-scroll',
  privateMessageDisplayFormat: 'wall-scroll',
  serverMessageBubbleAlignment: 'own-right',
  privateMessageBubbleAlignment: 'own-right',
  serverMessageBubbleWidth: 'standard',
  privateMessageBubbleWidth: 'standard',
  expandMessageAttachmentsByDefault: false,
  loadExternalMediaPreviews: true,
  horizontalVideoCardSize: 3,
  verticalVideoCardSize: 3,
  selectedThemeCode: 'sapphire',
  profileColor: null,
  profileBackgroundAssetId: null,
  applySystemThemeToOtherProfiles: true,
  directMessagePermission: 'everyone',
  presenceVisibility: 'everyone',
  showLastSeen: true,
  presenceMode: 'automatic'
};

test.describe('hub profile style', () => {
  test('maps interface scales and panel widths to CSS variables', () => {
    const style = buildHubProfileStyle({
      profileSettings: {
        ...defaultSettings,
        interfaceScale: 1.1,
        fontScale: 0.9,
        serverInterfaceScale: 1.2
      },
      hubPanelWidth: 280,
      spacePanelWidth: 310,
      memberPanelWidth: 260
    });

    expect(style).toMatchObject({
      '--profile-interface-scale': 1.1,
      '--profile-font-scale': 0.9,
      '--profile-server-scale': 1.2,
      '--profile-side-panel-width': '280px',
      '--profile-space-panel-width': '310px',
      '--profile-member-panel-width': '260px'
    });
    expect(style).not.toHaveProperty('--theme-profile-bg-image');
  });

  test('adds the profile background asset only when it is selected', () => {
    const style = buildHubProfileStyle({
      profileSettings: {
        ...defaultSettings,
        profileBackgroundAssetId: 'asset-1'
      },
      hubPanelWidth: 300,
      spacePanelWidth: 300,
      memberPanelWidth: 300
    });

    expect(style).toMatchObject({
      '--theme-profile-bg-image': 'url("/api/assets/asset-1/content")'
    });
  });
});
