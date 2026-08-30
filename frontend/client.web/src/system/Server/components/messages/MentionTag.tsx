import type { MessageMentionKind } from '../../../../shared/types';

import styles from './MentionTag.module.css';

type MentionTagProps = {
  kind: MessageMentionKind;
  label: string;
  title?: string;
};

export function MentionTag({ kind, label, title }: MentionTagProps) {
  const visibleLabel = label.startsWith('@') ? label : `@${label}`;

  return (
    <span
      className={styles.tag}
      data-mention-kind={kind}
      title={title ?? visibleLabel}
    >
      {visibleLabel}
    </span>
  );
}
