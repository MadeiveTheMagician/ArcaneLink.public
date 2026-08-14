import type { SelectHTMLAttributes } from 'react'
import { SystemIcon } from '../icons/SystemIcon'
import styles from './SystemField.module.css'

type SystemSelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function SystemSelect({ className = '', children, ...props }: SystemSelectProps) {
  return (
    <span className={styles.selectWrap}>
      <select {...props} className={`${styles.select} ${className}`}>
        {children}
      </select>
      <SystemIcon className={styles.selectIcon} name="chevron-down" size={16} />
    </span>
  )
}
