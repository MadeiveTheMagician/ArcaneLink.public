import {
  formatUnreadCount,
  getUnreadMessageLabel,
  normalizeUnreadCount
} from './unreadBadgeModel';

import styles from './UnreadBadge.module.css';

type UnreadBadgeProps = {
  count: number;
  className?: string;
};

export function UnreadBadge({ count, className = '' }: UnreadBadgeProps) {
  const normalizedCount = normalizeUnreadCount(count);
  const accessibleLabel = getUnreadMessageLabel(normalizedCount);

  if (!accessibleLabel) {
    return null;
  }

  return (
    <span
      className={`${styles.badge} ${className}`.trim()}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <span aria-hidden="true">{formatUnreadCount(normalizedCount)}</span>
    </span>
  );
}
