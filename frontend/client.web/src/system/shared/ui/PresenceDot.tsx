import type { ReactNode } from 'react';

import type { PresenceStatus } from '../../../shared/types';
import { commonCopy } from '../copy';

import styles from './PresenceDot.module.css';

export function PresenceDot({
  status,
  className = ''
}: {
  status: PresenceStatus;
  className?: string;
}) {
  if (status !== 'online') {
    return null;
  }

  return (
    <span
      className={`${styles.dot} ${className}`}
      data-presence-status={status}
      role="img"
      aria-label={commonCopy.status.online}
      title={commonCopy.status.online}
    />
  );
}

export function PresenceName({
  status,
  children,
  className = ''
}: {
  status: PresenceStatus | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (status !== 'online') {
    return <>{children}</>;
  }

  return (
    <span className={`${styles.name} ${className}`}>
      {children}
      <PresenceDot status={status} />
    </span>
  );
}
