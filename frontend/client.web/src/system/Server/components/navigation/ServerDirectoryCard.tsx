import { useId, useRef } from 'react';

import type {
  ServerDiscoveryResponse,
  ServerMemberResponse
} from '../../../../shared/types';
import {
  SystemButton,
  SystemCloseIcon,
  SystemIcon,
  UnreadBadge,
  serverCopy
} from '../../../shared';
import { resolveServerDirectoryAccessAction } from './serverDirectoryModel';

import styles from './ServerDirectoryCard.module.css';

type ServerDirectoryCardProps = {
  discovery: ServerDiscoveryResponse;
  isExpanded: boolean;
  membership: ServerMemberResponse | null;
  accessError: string | null;
  isAccessMutationPending: boolean;
  onCancelJoinRequest: () => void;
  onCollapse: () => void;
  onJoin: () => void;
  onOpen: (membership: ServerMemberResponse) => void;
  onRequestJoin: () => void;
  onToggle: () => void;
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function ServerDirectoryCard({
  discovery,
  isExpanded,
  membership,
  accessError,
  isAccessMutationPending,
  onCancelJoinRequest,
  onCollapse,
  onJoin,
  onOpen,
  onRequestJoin,
  onToggle
}: ServerDirectoryCardProps) {
  const server = discovery.server;
  const accessAction = resolveServerDirectoryAccessAction(discovery);
  const detailsId = useId();
  const summaryRef = useRef<HTMLButtonElement>(null);

  function handleCollapse() {
    summaryRef.current?.focus();
    onCollapse();
  }

  return (
    <article
      className={`${styles.card} ${isExpanded ? styles.expanded : ''}`}
      data-expanded={isExpanded}
    >
      <button
        className={styles.collapseButton}
        type="button"
        aria-hidden={!isExpanded}
        aria-label={serverCopy.browser.collapse}
        title={serverCopy.browser.collapse}
        tabIndex={isExpanded ? 0 : -1}
        onClick={handleCollapse}
      >
        <SystemCloseIcon size="small" />
      </button>

      <button
        ref={summaryRef}
        className={styles.summary}
        type="button"
        aria-controls={detailsId}
        aria-expanded={isExpanded}
        aria-label={`${server.title}: ${
          isExpanded ? serverCopy.browser.collapse : serverCopy.browser.expand
        }`}
        onClick={onToggle}
      >
        <UnreadBadge
          className={styles.unreadBadge}
          count={membership?.unreadCount ?? 0}
        />
        <ServerDirectoryIcon discovery={discovery} />
        <span className={styles.summaryBody}>
          <strong className={styles.title}>{server.title}</strong>
          <span className={styles.slug}>/{server.slug}</span>
          <span className={styles.metrics}>
            <Metric
              icon="friends"
              label={serverCopy.browser.memberCount}
              value={discovery.memberCount}
            />
            <Metric
              icon="message"
              label={serverCopy.browser.textSpaceCount}
              value={discovery.textSpaceCount}
            />
            <Metric
              icon="speaker"
              label={serverCopy.browser.voiceSpaceCount}
              value={discovery.voiceSpaceCount}
            />
          </span>
        </span>
      </button>

      <div
        id={detailsId}
        className={styles.detailsReveal}
        aria-hidden={!isExpanded}
        inert={!isExpanded}
      >
        <div className={styles.detailsClip}>
          <div className={styles.details}>
            <p className={styles.description}>
              {server.description?.trim() ||
                serverCopy.browser.defaultDescription}
            </p>

            <dl className={styles.detailGrid}>
              <Detail
                label={serverCopy.browser.memberCount}
                value={`${discovery.memberCount} · ${discovery.onlineMemberCount} ${serverCopy.browser.online}`}
              />
              <Detail
                label={serverCopy.browser.friendCount}
                value={String(discovery.friendCount)}
              />
              <Detail
                label={serverCopy.browser.textSpaceCount}
                value={String(discovery.textSpaceCount)}
              />
              <Detail
                label={serverCopy.browser.voiceSpaceCount}
                value={String(discovery.voiceSpaceCount)}
              />
              <Detail
                label={serverCopy.browser.lastActivity}
                value={formatDate(discovery.lastActivityAt)}
              />
              <Detail
                label={
                  discovery.isMember
                    ? serverCopy.browser.joinedAt
                    : serverCopy.browser.access
                }
                value={
                  discovery.joinedAt
                    ? formatDate(discovery.joinedAt)
                    : getServerAccessModeLabel(server.accessMode)
                }
              />
            </dl>

            <section
              className={styles.roles}
              aria-label={serverCopy.browser.roles}
            >
              <span>{serverCopy.browser.roles}</span>
              <div>
                {discovery.currentUserRoleTitles.length > 0 ? (
                  discovery.currentUserRoleTitles.map((roleTitle, index) => (
                    <span
                      className={styles.roleTag}
                      key={`${roleTitle}-${index}`}
                    >
                      {roleTitle}
                    </span>
                  ))
                ) : (
                  <small>{serverCopy.browser.noRoles}</small>
                )}
              </div>
            </section>

            <footer className={styles.footer}>
              {membership ? (
                <SystemButton size="small" onClick={() => onOpen(membership)}>
                  {serverCopy.browser.openServer}
                </SystemButton>
              ) : accessAction === 'join' ? (
                <SystemButton
                  size="small"
                  disabled={isAccessMutationPending}
                  onClick={onJoin}
                >
                  {serverCopy.browser.joinServer}
                </SystemButton>
              ) : accessAction === 'request' ? (
                <SystemButton
                  size="small"
                  disabled={isAccessMutationPending}
                  onClick={onRequestJoin}
                >
                  {serverCopy.browser.requestJoin}
                </SystemButton>
              ) : accessAction === 'pending' ? (
                <div className={styles.pendingActions}>
                  <span>{serverCopy.browser.joinRequestPending}</span>
                  <SystemButton
                    size="small"
                    variant="ghost"
                    disabled={isAccessMutationPending}
                    onClick={onCancelJoinRequest}
                  >
                    {serverCopy.browser.cancelJoinRequest}
                  </SystemButton>
                </div>
              ) : (
                <p>{serverCopy.browser.notMember}</p>
              )}
              {accessError ? (
                <p className={styles.accessError} role="alert">
                  {accessError}
                </p>
              ) : null}
            </footer>
          </div>
        </div>
      </div>
    </article>
  );
}

function ServerDirectoryIcon({
  discovery
}: {
  discovery: ServerDiscoveryResponse;
}) {
  const server = discovery.server;

  return (
    <span className={styles.icon} aria-hidden="true">
      {server.iconAssetId ? (
        <img
          className="ui-media-fit"
          src={`/api/assets/${server.iconAssetId}/content`}
          alt=""
          style={{
            transform: `translate(${server.iconCropOffsetX * 100}%, ${
              server.iconCropOffsetY * 100
            }%) scale(${server.iconCropZoom})`
          }}
        />
      ) : (
        server.title.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: 'friends' | 'message' | 'speaker';
  label: string;
  value: number;
}) {
  return (
    <span className={styles.metric} title={label}>
      <SystemIcon name={icon} size={15} />
      <span>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function getServerAccessModeLabel(
  accessMode: ServerDiscoveryResponse['server']['accessMode']
) {
  if (accessMode === 'public') {
    return serverCopy.browser.publicServer;
  }

  if (accessMode === 'restricted') {
    return serverCopy.browser.restrictedServer;
  }

  return serverCopy.browser.privateServer;
}
