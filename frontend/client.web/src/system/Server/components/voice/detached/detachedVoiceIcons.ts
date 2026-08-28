import {
  type SystemIconCssName,
  getSystemIconCss
} from '../../../../shared/icons/systemIconCss';

export type DetachedControlIconName =
  | 'mic'
  | 'headphones'
  | 'camera'
  | 'screen'
  | 'leave'
  | 'message'
  | 'settings'
  | 'fullscreen'
  | 'close';

export type DetachedUtilityIconName = 'lock' | 'plus' | 'settings' | 'unlock';

const detachedControlIconByName = {
  camera: 'camera-off',
  close: 'collapse',
  fullscreen: 'fullscreen',
  headphones: 'headphones-off',
  leave: 'leave',
  message: 'message',
  mic: 'mic-off',
  screen: 'screen-off',
  settings: 'settings'
} as const satisfies Record<DetachedControlIconName, SystemIconCssName>;

const activeDetachedControlIconByName: Partial<
  Record<DetachedControlIconName, SystemIconCssName>
> = {
  camera: 'camera',
  headphones: 'headphones-on',
  mic: 'mic-on',
  screen: 'screen'
};

const detachedUtilityIconByName = {
  lock: 'lock',
  plus: 'plus',
  settings: 'settings',
  unlock: 'unlock'
} as const satisfies Record<DetachedUtilityIconName, SystemIconCssName>;

export function getDetachedControlIconCss(
  icon: DetachedControlIconName,
  active = false
) {
  const activeIcon = active ? activeDetachedControlIconByName[icon] : undefined;
  return getSystemIconCss(activeIcon ?? detachedControlIconByName[icon]);
}

export function getDetachedUtilityIconCss(icon: DetachedUtilityIconName) {
  return getSystemIconCss(detachedUtilityIconByName[icon]);
}
