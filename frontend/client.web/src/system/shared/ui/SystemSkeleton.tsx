import type { CSSProperties, HTMLAttributes } from 'react';

import styles from './SystemSkeleton.module.css';

export type SystemSkeletonVariant = 'text' | 'block' | 'circle' | 'button';

type SystemSkeletonProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'aria-hidden' | 'children'
> & {
  animated?: boolean;
  delayMs?: number;
  height?: CSSProperties['height'];
  size?: CSSProperties['width'];
  variant?: SystemSkeletonVariant;
  width?: CSSProperties['width'];
};

type SkeletonStyle = CSSProperties & {
  '--system-skeleton-delay': string;
};

export function SystemSkeleton({
  animated = true,
  className = '',
  delayMs = 150,
  height,
  size,
  style,
  variant = 'text',
  width,
  ...props
}: SystemSkeletonProps) {
  const resolvedSize = variant === 'circle' ? size : undefined;
  const skeletonStyle: SkeletonStyle = {
    ...style,
    '--system-skeleton-delay': `${Math.max(0, delayMs)}ms`,
    width: resolvedSize ?? width ?? style?.width,
    height: resolvedSize ?? height ?? style?.height
  };

  return (
    <span
      {...props}
      aria-hidden="true"
      className={[styles.skeleton, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
      data-animated={animated ? 'true' : 'false'}
      style={skeletonStyle}
    />
  );
}
