import type { HTMLAttributes, ReactNode } from 'react'
import styles from './SystemPanel.module.css'

type SystemPanelProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode
  padding?: 'compact' | 'comfortable' | 'spacious'
  tone?: 'raised' | 'flat'
}

export function SystemPanel({
  children,
  className = '',
  padding = 'comfortable',
  tone = 'raised',
  ...props
}: SystemPanelProps) {
  return (
    <section
      {...props}
      className={[
        styles.panel,
        styles[padding],
        tone === 'flat' ? styles.flat : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </section>
  )
}
