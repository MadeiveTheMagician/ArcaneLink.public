import type { InputHTMLAttributes, ReactNode } from 'react';

import { SystemIcon } from '../icons/SystemIcon';

import styles from './SystemCheckbox.module.css';

type SystemCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  children?: ReactNode;
};

export function SystemCheckbox({
  children,
  className = '',
  ...props
}: SystemCheckboxProps) {
  return (
    <label className={`${styles.label} ${className}`}>
      <input {...props} className={styles.input} type="checkbox" />
      <span className={styles.box} aria-hidden="true">
        {props.checked ? <SystemIcon name="check" size={14} /> : null}
      </span>
      {children ? <span className={styles.text}>{children}</span> : null}
    </label>
  );
}
