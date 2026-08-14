import { SystemSkeleton } from '../../../shared/ui/SystemSkeleton'
import styles from './ServerChannelTreeSkeleton.module.css'

const skeletonGroups = [3, 4, 3]

export function ServerChannelTreeSkeleton() {
  return (
    <div className={styles.spaceTreeSkeleton} aria-hidden="true">
      {skeletonGroups.map((channelCount, groupIndex) => (
        <section
          className={styles.categorySkeleton}
          key={`group-${groupIndex + 1}`}
        >
          <div className={styles.categoryHeaderSkeleton}>
            <SystemSkeleton height={10} variant="text" width={10} />
            <SystemSkeleton
              height={10}
              variant="text"
              width={groupIndex % 2 === 0 ? '52%' : '66%'}
            />
          </div>
          <div className={styles.channelSkeletonList}>
            {Array.from({ length: channelCount }, (_, channelIndex) => (
              <div
                className={styles.channelSkeleton}
                key={`group-${groupIndex + 1}-channel-${channelIndex + 1}`}
              >
                <SystemSkeleton
                  className={styles.channelIconSkeleton}
                  size={20}
                  variant="circle"
                />
                <span className={styles.channelTextSkeleton}>
                  <SystemSkeleton
                    height={10}
                    variant="text"
                    width={channelIndex % 2 === 0 ? '64%' : '48%'}
                  />
                  <SystemSkeleton
                    className={styles.channelSubtitleSkeleton}
                    height={8}
                    variant="text"
                    width={channelIndex % 2 === 0 ? '42%' : '56%'}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
