import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './SelectedFrame.module.css'

type SelectedFrameProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'checked' | 'children' | 'onChange' | 'type'
> & {
  checked: boolean
  children: ReactNode
  onChange: (checked: boolean) => void
}

export function SelectedFrame({
  checked,
  children,
  className = '',
  onChange,
  ...inputProps
}: SelectedFrameProps) {
  return (
    <label
      className={`${styles.frame} ${checked ? styles.selected : ''} ${className}`}
    >
      <input
        {...inputProps}
        className={styles.input}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.content}>{children}</span>
    </label>
  )
}
