import { expect, test } from '@playwright/test';

import {
  responsiveMemberPanelCompactMaxWidth,
  shouldUseResponsiveMemberPanelCompact
} from '../../src/system/shared/hooks/usePanelResize';

test.describe('responsive member panel model', () => {
  test('compacts before the workspace becomes cramped', () => {
    expect(responsiveMemberPanelCompactMaxWidth).toBe(1200);
    expect(shouldUseResponsiveMemberPanelCompact(1201)).toBe(false);
    expect(shouldUseResponsiveMemberPanelCompact(1200)).toBe(true);
    expect(shouldUseResponsiveMemberPanelCompact(760)).toBe(true);
  });
});
