import type { ButtonHTMLAttributes } from 'react';

import {
  SystemIcon,
  type SystemIconName,
  type SystemIconSize
} from '../icons/SystemIcon';
import { SystemButton } from './SystemButton';

type SystemIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> & {
  icon: SystemIconName;
  iconSize?: SystemIconSize;
  label: string;
};

export function SystemIconButton({
  className = '',
  icon,
  iconSize = 'medium',
  label,
  variant = undefined,
  ...props
}: SystemIconButtonProps & {
  variant?: 'primary' | 'ghost' | 'danger' | 'asset';
}) {
  return (
    <SystemButton
      {...props}
      className={className}
      variant={variant ?? 'asset'}
      aria-label={label}
      title={props.title}
    >
      <SystemIcon name={icon} size={iconSize} />
    </SystemButton>
  );
}
