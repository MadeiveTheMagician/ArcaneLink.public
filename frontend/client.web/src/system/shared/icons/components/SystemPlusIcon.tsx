import { SystemIcon } from '../SystemIcon'
import styles from './SystemPlusIcon.module.css'

type SystemPlusIconProps = {
  className?: string
  size?: 'small' | 'medium' | 'large'
}

const plusIconSizes: Record<NonNullable<SystemPlusIconProps['size']>, number> = {
  small: 16,
  medium: 22,
  large: 38,
}

export function SystemPlusIcon({
  className = '',
  size = 'medium',
}: SystemPlusIconProps) {
  return (
    <SystemIcon
      className={`${styles.icon} ${styles[size]} ${className}`}
      name="plus"
      size={plusIconSizes[size]}
      glow
    />
  )
}
