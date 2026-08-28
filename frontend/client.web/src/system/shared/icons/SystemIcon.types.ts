export const navigationIconNames = [
  'back',
  'block',
  'check',
  'chevron-down',
  'chevron-right',
  'close',
  'copy',
  'download',
  'eye',
  'eye-off',
  'edit',
  'flag',
  'menu',
  'more',
  'more-vertical',
  'plus',
  'search',
  'sliders',
  'trash'
] as const;

export const communicationIconNames = [
  'camera',
  'camera-off',
  'archive',
  'file',
  'folder',
  'headphones-off',
  'headphones-on',
  'leave',
  'mail',
  'message',
  'mic-off',
  'mic-on',
  'paperclip',
  'phone',
  'phone-call',
  'screen',
  'screen-off',
  'send',
  'smile',
  'speaker',
  'video'
] as const;

export const identityIconNames = [
  'friends',
  'globe',
  'lock',
  'pin',
  'server',
  'settings',
  'user',
  'user-plus',
  'unlock'
] as const;

export type NavigationIconName = (typeof navigationIconNames)[number];
export type CommunicationIconName = (typeof communicationIconNames)[number];
export type IdentityIconName = (typeof identityIconNames)[number];
export type SystemIconName =
  NavigationIconName | CommunicationIconName | IdentityIconName;

export type SystemIconSize = 'small' | 'medium' | 'large' | number;
