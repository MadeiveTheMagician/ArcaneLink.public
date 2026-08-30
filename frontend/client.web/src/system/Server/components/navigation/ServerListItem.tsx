import type { ServerMemberResponse } from '../../../../shared/types';
import { UnreadBadge, serverCopy } from '../../../shared/index';

import styles from './ServerListItem.module.css';

type ServerListItemProps = {
  membership: ServerMemberResponse;
  onOpen: (membership: ServerMemberResponse) => void;
};

export function ServerListItem({ membership, onOpen }: ServerListItemProps) {
  const { server, lastMessage } = membership;
  const preview = lastMessage?.body?.trim();
  const previewText =
    preview && preview.length > 0
      ? preview
      : lastMessage
        ? serverCopy.serverList.lastMessageEmpty
        : server.description?.trim() || serverCopy.serverList.emptyMessage;

  return (
    <button
      className={styles.item}
      type="button"
      onClick={() => onOpen(membership)}
    >
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
      <span className={styles.body}>
        <span className={styles.titleRow}>
          <strong className="ui-ellipsis">{server.title}</strong>
          <span className={styles.titleMeta}>
            {lastMessage && (
              <time dateTime={lastMessage.createdAt}>
                {formatServerTime(lastMessage.createdAt)}
              </time>
            )}
            <UnreadBadge count={membership.unreadCount} />
          </span>
        </span>
        <small className="ui-ellipsis">
          {lastMessage
            ? `#${lastMessage.spaceTitle}`
            : getAccessModeLabel(server.accessMode)}
        </small>
        <span className={styles.preview}>{previewText}</span>
      </span>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </button>
  );
}

function getAccessModeLabel(
  accessMode: ServerMemberResponse['server']['accessMode']
) {
  if (accessMode === 'public') {
    return serverCopy.serverList.publicServer;
  }

  if (accessMode === 'restricted') {
    return serverCopy.serverList.restrictedServer;
  }

  return serverCopy.serverList.privateServer;
}

function formatServerTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
