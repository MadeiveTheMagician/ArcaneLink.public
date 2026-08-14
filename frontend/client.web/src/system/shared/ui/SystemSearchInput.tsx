import type { InputHTMLAttributes } from 'react'
import { SystemIcon } from '../icons/SystemIcon'
import styles from './SystemField.module.css'

type SystemSearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function SystemSearchInput({ className = '', ...props }: SystemSearchInputProps) {
  return (
    <label className={`${styles.search} ${className}`}>
      <SystemIcon name="search" size={15} />
      <input {...props} type="search" />
    </label>
  )
}
