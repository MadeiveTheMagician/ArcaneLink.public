import type { ReactNode } from 'react';

import {
  SystemSkeleton,
  type SystemSkeletonPresencePhase,
  SystemSkeletonRegion
} from '../../../shared';

import styles from './CommunitySkeletons.module.css';

const defaultRevealDelayMs = 120;

function SkeletonGroup({
  children,
  label,
  className = '',
  presencePhase
}: {
  children: ReactNode;
  label: string;
  className?: string;
  presencePhase?: SystemSkeletonPresencePhase;
}) {
  return (
    <SystemSkeletonRegion
      className={[styles.group, className].filter(Boolean).join(' ')}
      label={label}
      presencePhase={presencePhase}
    >
      {children}
    </SystemSkeletonRegion>
  );
}

export function CommunityStatsSkeleton({
  label,
  presencePhase
}: {
  label: string;
  presencePhase?: SystemSkeletonPresencePhase;
}) {
  return (
    <SystemSkeletonRegion
      className={styles.stats}
      label={label}
      presencePhase={presencePhase}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <article key={`community-stat-skeleton-${index}`}>
          <SystemSkeleton
            delayMs={defaultRevealDelayMs}
            size={26}
            variant="circle"
          />
          <div>
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={20}
              width={34}
            />
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={11}
              width="min(82px, 90%)"
            />
          </div>
        </article>
      ))}
    </SystemSkeletonRegion>
  );
}

export function CommunityPersonListSkeleton({
  count = 6,
  label,
  presencePhase,
  withPrimaryAction = false
}: {
  count?: number;
  label: string;
  presencePhase?: SystemSkeletonPresencePhase;
  withPrimaryAction?: boolean;
}) {
  return (
    <SkeletonGroup
      className={styles.personList}
      label={label}
      presencePhase={presencePhase}
    >
      {Array.from({ length: count }, (_, index) => (
        <article
          className={[
            styles.personRow,
            withPrimaryAction ? styles.searchPersonRow : ''
          ]
            .filter(Boolean)
            .join(' ')}
          key={`community-person-skeleton-${index}`}
        >
          <SystemSkeleton
            className={styles.avatar}
            delayMs={defaultRevealDelayMs}
            height={50}
            width={50}
            variant="block"
          />
          <div className={styles.personIdentity}>
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={14}
              width={`${58 + (index % 3) * 10}%`}
            />
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={10}
              width={`${42 + (index % 2) * 12}%`}
            />
          </div>
          <SystemSkeleton
            className={styles.personStatus}
            delayMs={defaultRevealDelayMs}
            height={11}
            width={86}
          />
          <SystemSkeleton
            className={styles.personServer}
            delayMs={defaultRevealDelayMs}
            height={11}
            width="76%"
          />
          {withPrimaryAction ? (
            <SystemSkeleton
              className={styles.primaryAction}
              delayMs={defaultRevealDelayMs}
              height={38}
              width={148}
              variant="button"
            />
          ) : (
            <div className={styles.personActions}>
              {Array.from({ length: 3 }, (_, actionIndex) => (
                <SystemSkeleton
                  delayMs={defaultRevealDelayMs}
                  height={34}
                  key={`community-person-action-skeleton-${actionIndex}`}
                  width={34}
                  variant="button"
                />
              ))}
            </div>
          )}
        </article>
      ))}
    </SkeletonGroup>
  );
}

export function CommunityRequestListSkeleton({
  count = 5,
  label,
  presencePhase,
  singleAction = false
}: {
  count?: number;
  label: string;
  presencePhase?: SystemSkeletonPresencePhase;
  singleAction?: boolean;
}) {
  return (
    <SkeletonGroup
      className={styles.requestList}
      label={label}
      presencePhase={presencePhase}
    >
      {Array.from({ length: count }, (_, index) => (
        <article
          className={styles.requestRow}
          key={`community-request-skeleton-${index}`}
        >
          <SystemSkeleton
            className={styles.requestAvatar}
            delayMs={defaultRevealDelayMs}
            height={40}
            width={40}
            variant="block"
          />
          <div>
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={13}
              width={`${68 + (index % 2) * 12}%`}
            />
            <SystemSkeleton
              delayMs={defaultRevealDelayMs}
              height={9}
              width={`${52 + (index % 3) * 8}%`}
            />
          </div>
          <div className={styles.requestActions}>
            {Array.from({ length: singleAction ? 1 : 2 }, (_, actionIndex) => (
              <SystemSkeleton
                delayMs={defaultRevealDelayMs}
                height={28}
                key={`community-request-action-skeleton-${actionIndex}`}
                width={singleAction ? 42 : 32}
                variant="button"
              />
            ))}
          </div>
        </article>
      ))}
    </SkeletonGroup>
  );
}
