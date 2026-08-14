import {
  SystemSkeleton,
  SystemSkeletonRegion,
  type SystemSkeletonPresencePhase,
} from '../../../shared'
import styles from './ServerDirectoryGridSkeleton.module.css'

export function ServerDirectoryGridSkeleton({
  count = 6,
  label,
  presencePhase,
}: {
  count?: number
  label: string
  presencePhase?: SystemSkeletonPresencePhase
}) {
  return (
    <SystemSkeletonRegion
      className={styles.grid}
      label={label}
      presencePhase={presencePhase}
    >
      {Array.from({ length: count }, (_, index) => {
        const delayMs = 80 + index * 38

        return (
          <article
            className={styles.card}
            key={`server-directory-skeleton-${index}`}
          >
            <SystemSkeleton
              className={styles.icon}
              delayMs={delayMs}
              height={54}
              variant="block"
              width={54}
            />
            <div className={styles.body}>
              <SystemSkeleton
                delayMs={delayMs}
                height={14}
                width={`${48 + (index % 3) * 12}%`}
              />
              <SystemSkeleton
                delayMs={delayMs}
                height={9}
                width={`${30 + (index % 2) * 10}%`}
              />
              <div className={styles.metrics}>
                {Array.from({ length: 3 }, (_, metricIndex) => (
                  <SystemSkeleton
                    delayMs={delayMs}
                    height={23}
                    key={`server-directory-skeleton-${index}-metric-${metricIndex}`}
                    variant="block"
                    width={44 + metricIndex * 5}
                  />
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </SystemSkeletonRegion>
  )
}
