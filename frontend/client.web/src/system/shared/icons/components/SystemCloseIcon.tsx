import { SystemIcon } from '../SystemIcon'
import styles from './SystemCloseIcon.module.css'

type SystemCloseIconProps = {
  className?: string
  size?: 'small' | 'medium' | 'large'
}

const closeIconSizes: Record<NonNullable<SystemCloseIconProps['size']>, number> = {
  small: 16,
  medium: 32,
  large: 64,
}

export function SystemCloseIcon({
  className = '',
  size = 'medium',
}: SystemCloseIconProps) {
  return (
    <SystemIcon
      className={`${styles.icon} ${styles[size]} ${className}`}
      name="close"
      size={closeIconSizes[size]}
      glow
    />
  )
}
