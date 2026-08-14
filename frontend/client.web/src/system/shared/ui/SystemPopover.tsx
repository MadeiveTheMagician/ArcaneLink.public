import type { HTMLAttributes, ReactNode } from 'react'
import styles from './SystemPopover.module.css'

type SystemPopoverProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
}

export function SystemPopover({ children, className = '', ...props }: SystemPopoverProps) {
  return (
    <div {...props} className={`${styles.popover} ${className}`}>
      {children}
    </div>
  )
}
