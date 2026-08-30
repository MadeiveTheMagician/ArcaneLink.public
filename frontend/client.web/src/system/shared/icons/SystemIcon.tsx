import { type CSSProperties, useId } from 'react';

import type { SystemIconName, SystemIconSize } from './SystemIcon.types';
import { SystemIconGlyph } from './SystemIconGlyph';

import styles from './SystemIcon.module.css';

export type { SystemIconName, SystemIconSize } from './SystemIcon.types';

type SystemIconProps = {
  className?: string;
  glow?: boolean;
  monochrome?: boolean;
  name: SystemIconName;
  size?: SystemIconSize;
  title?: string;
  tone?: 'default' | 'danger';
};

const iconSizes: Record<Exclude<SystemIconSize, number>, number> = {
  small: 16,
  medium: 22,
  large: 38
};

function getIconSize(size: SystemIconSize) {
  return typeof size === 'number' ? size : iconSizes[size];
}

export function SystemIcon({
  className = '',
  glow = false,
  monochrome = false,
  name,
  size = 'medium',
  title,
  tone = 'default'
}: SystemIconProps) {
  const definitionId = useId().replace(/:/g, '');
  const fillId = `${definitionId}-fill`;
  const boxFillId = `${definitionId}-fill-box`;
  const glowId = `${definitionId}-glow`;
  const pixelSize = getIconSize(size);
  const isCompact = pixelSize <= 24;
  const style = {
    '--system-icon-size': `${pixelSize}px`,
    '--system-icon-fill': monochrome ? 'currentColor' : `url(#${fillId})`,
    '--system-icon-fill-box': monochrome
      ? 'currentColor'
      : `url(#${boxFillId})`,
    '--system-icon-glow': `url(#${glowId})`
  } as CSSProperties;

  return (
    <span
      className={`${styles.icon} ${isCompact ? styles.compact : ''} ${glow ? styles.softGlow : ''} ${
        tone === 'danger' ? styles.danger : ''
      } ${className}`}
      style={style}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      <svg viewBox="0 0 24 24" focusable="false" aria-label={title}>
        <defs>
          <linearGradient
            id={fillId}
            x1="4"
            y1="3"
            x2="20"
            y2="21"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--theme-icon-gradient-start)" />
            <stop offset=".26" stopColor="var(--theme-icon-gradient-middle)" />
            <stop offset=".62" stopColor="var(--theme-accent-light)" />
            <stop offset="1" stopColor="var(--theme-icon-gradient-end)" />
          </linearGradient>
          <linearGradient id={boxFillId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--theme-icon-gradient-start)" />
            <stop offset=".26" stopColor="var(--theme-icon-gradient-middle)" />
            <stop offset=".62" stopColor="var(--theme-accent-light)" />
            <stop offset="1" stopColor="var(--theme-icon-gradient-end)" />
          </linearGradient>
          <filter id={glowId} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation=".34" result="blur" />
            <feFlood
              floodColor="var(--theme-icon-glow-color)"
              floodOpacity=".58"
            />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {title ? <title>{title}</title> : null}
        <SystemIconGlyph name={name} />
      </svg>
    </span>
  );
}
