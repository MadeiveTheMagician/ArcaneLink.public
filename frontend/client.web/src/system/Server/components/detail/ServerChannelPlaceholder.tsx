import { serverCopy } from '../../../shared/index';

import styles from './ServerChannelPlaceholder.module.css';

export function ServerChannelPlaceholder({
  serverTitle,
  title,
  kind = 'text'
}: {
  serverTitle: string;
  title?: string;
  kind?: 'text' | 'voice';
}) {
  return (
    <section className={styles.channelPlaceholder}>
      <header>
        <div>
          <span>{kind === 'voice' ? '◁' : '#'}</span>
          <strong>{title ?? serverCopy.labels.selectSpace}</strong>
        </div>
        <p>
          {title
            ? serverCopy.text.spaceInServer(
                kind === 'voice'
                  ? serverCopy.labels.voiceSpace
                  : serverCopy.labels.textSpace,
                serverTitle
              )
            : serverCopy.text.chooseSpaceInServer(serverTitle)}
        </p>
      </header>
      <div className={styles.placeholderFeed}>
        <article>
          <strong>{serverCopy.labels.arcaneLink}</strong>
          <p>
            {title
              ? serverCopy.labels.channelUnavailable
              : serverCopy.labels.unavailableHint}
          </p>
        </article>
      </div>
    </section>
  );
}
