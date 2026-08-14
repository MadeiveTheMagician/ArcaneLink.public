import type { HTMLAttributes, ReactNode } from 'react'
import type { SystemSkeletonPresencePhase } from './systemSkeletonPresenceModel'
import styles from './SystemSkeletonRegion.module.css'

type SystemSkeletonRegionProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-busy' | 'aria-label' | 'children' | 'role'
> & {
  children: ReactNode
  label: string
  presencePhase?: SystemSkeletonPresencePhase
}

export function SystemSkeletonRegion({
  children,
  className = '',
  label,
  presencePhase = 'visible',
  ...props
}: SystemSkeletonRegionProps) {
  return (
    <div
      {...props}
      role="status"
      aria-atomic="true"
      aria-busy="true"
      aria-label={label}
      className={[styles.region, styles[presencePhase], className]
        .filter(Boolean)
        .join(' ')}
      data-presence-phase={presencePhase}
    >
      {children}
    </div>
  )
}
