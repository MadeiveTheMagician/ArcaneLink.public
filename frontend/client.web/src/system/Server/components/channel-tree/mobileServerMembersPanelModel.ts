export type MobileServerTab = 'spaces' | 'members';

export function isMobileMembersPanelOpen(
  isMobileServerTree: boolean,
  mobileServerTab: MobileServerTab
) {
  return isMobileServerTree && mobileServerTab === 'members';
}
