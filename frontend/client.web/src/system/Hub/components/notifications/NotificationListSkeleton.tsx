import {
  SystemSkeleton,
  type SystemSkeletonPresencePhase,
  SystemSkeletonRegion
} from '../../../shared';

import styles from './NotificationListSkeleton.module.css';

export function NotificationListSkeleton({
  count = 6,
  label,
  presencePhase
}: {
  count?: number;
  label: string;
  presencePhase?: SystemSkeletonPresencePhase;
}) {
  return (
    <SystemSkeletonRegion
      className={styles.list}
      label={label}
      presencePhase={presencePhase}
    >
      {Array.from({ length: count }, (_, index) => {
        const delayMs = 90 + index * 34;

        return (
          <article
            className={styles.row}
            key={`notification-skeleton-${index}`}
          >
            <SystemSkeleton
              className={styles.kind}
              delayMs={delayMs}
              height={42}
              variant="block"
              width={42}
            />
            <SystemSkeleton
              className={styles.actor}
              delayMs={delayMs}
              height={40}
              variant="block"
              width={40}
            />
            <div className={styles.body}>
              <SystemSkeleton
                delayMs={delayMs}
                height={13}
                width={`${38 + (index % 3) * 12}%`}
              />
              <SystemSkeleton
                delayMs={delayMs}
                height={10}
                width={`${66 + (index % 2) * 14}%`}
              />
              {index % 2 === 0 ? (
                <SystemSkeleton delayMs={delayMs} height={9} width="52%" />
              ) : null}
            </div>
            <SystemSkeleton delayMs={delayMs} height={9} width={48} />
          </article>
        );
      })}
    </SystemSkeletonRegion>
  );
}
