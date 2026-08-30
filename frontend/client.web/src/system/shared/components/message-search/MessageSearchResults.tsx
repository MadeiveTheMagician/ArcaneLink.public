import type { SpaceMessageResponse } from '../../../../shared/types';
import { messageSearchCopy } from './messageSearch.copy.ts';

import styles from './MessageSearchResults.module.css';

type MessageSearchResultsProps = {
  query: string;
  results: SpaceMessageResponse[];
  isSearching: boolean;
  error: string | null;
  getSpaceLabel?: (message: SpaceMessageResponse) => string | null;
  getCategoryLabel?: (message: SpaceMessageResponse) => string | null;
  onOpenMessage: (message: SpaceMessageResponse) => void;
};

export function MessageSearchResults({
  query,
  results,
  isSearching,
  error,
  getSpaceLabel,
  getCategoryLabel,
  onOpenMessage
}: MessageSearchResultsProps) {
  return (
    <section
      className={styles.panel}
      aria-label={messageSearchCopy.aria.results}
    >
      <header className={styles.header}>
        <span>{messageSearchCopy.results.found}</span>
        <strong>{isSearching ? '...' : results.length}</strong>
      </header>

      <div className={`${styles.list} ui-scrollbar-none`}>
        {isSearching && (
          <p className={styles.empty}>{messageSearchCopy.results.searching}</p>
        )}
        {!isSearching && error && <p className={styles.empty}>{error}</p>}
        {!isSearching && !error && results.length === 0 && (
          <p className={styles.empty}>
            {query
              ? messageSearchCopy.results.emptyForQuery(query)
              : messageSearchCopy.results.empty}
          </p>
        )}
        {!isSearching &&
          !error &&
          results.map((message) => {
            const spaceLabel = getSpaceLabel?.(message);
            const categoryLabel = getCategoryLabel?.(message);
            const body =
              message.body?.trim() || messageSearchCopy.attachments.withoutText;

            return (
              <article key={message.id} className={styles.resultGroup}>
                {(spaceLabel || categoryLabel) && (
                  <header className={styles.location}>
                    {spaceLabel && (
                      <span className={`${styles.spaceLabel} ui-ellipsis`}>
                        # {spaceLabel}
                      </span>
                    )}
                    {categoryLabel && (
                      <span className={`${styles.categoryLabel} ui-ellipsis`}>
                        ▣ {categoryLabel}
                      </span>
                    )}
                  </header>
                )}
                <button
                  className={styles.result}
                  type="button"
                  onClick={() => onOpenMessage(message)}
                >
                  <span
                    className={`${styles.avatar} ui-frame`}
                    aria-hidden="true"
                  >
                    {message.senderAvatarAssetId ? (
                      <img
                        className="ui-media-fit"
                        src={`/api/assets/${message.senderAvatarAssetId}/content`}
                        alt=""
                        style={{
                          transform: `translate(${
                            message.senderAvatarCropOffsetX * 100
                          }%, ${
                            message.senderAvatarCropOffsetY * 100
                          }%) scale(${message.senderAvatarCropZoom})`
                        }}
                      />
                    ) : (
                      message.senderDisplayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className={styles.body}>
                    <span className={styles.meta}>
                      <strong className="ui-ellipsis">
                        {message.senderDisplayName}
                      </strong>
                      <time dateTime={message.createdAt}>
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </span>
                    <span className={styles.preview}>{body}</span>
                  </span>
                </button>
              </article>
            );
          })}
      </div>
    </section>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
