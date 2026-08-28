import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './SystemButton.module.css';

type SystemButtonVariant = 'primary' | 'ghost' | 'danger' | 'asset';
type SystemButtonSize = 'small' | 'medium' | 'large';

type SystemButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  fullWidth?: boolean;
  size?: SystemButtonSize;
  variant?: SystemButtonVariant;
};

export function SystemButton({
  children,
  className = '',
  fullWidth = false,
  size = 'medium',
  type = 'button',
  variant = 'primary',
  ...props
}: SystemButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        styles.button,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}
