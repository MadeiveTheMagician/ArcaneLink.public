import type { RefObject } from 'react'
import type { DraftMention } from './mentions'
import styles from './MessageComposerMentionOverlay.module.css'

export function MessageComposerMentionOverlay({
  text,
  mentions,
  overlayRef,
}: {
  text: string
  mentions: readonly DraftMention[]
  overlayRef: RefObject<HTMLDivElement | null>
}) {
  const parts = []
  let cursor = 0

  for (const mention of [...mentions].sort((left, right) => left.start - right.start)) {
    if (
      mention.start < cursor ||
      mention.start < 0 ||
      mention.start + mention.length > text.length
    ) {
      continue
    }

    parts.push(text.slice(cursor, mention.start))
    parts.push(
      <mark
        className={styles.mention}
        data-mention-kind={mention.kind}
        key={`${mention.kind}:${mention.targetId ?? 'everyone'}:${mention.start}`}
      >
        {text.slice(mention.start, mention.start + mention.length)}
      </mark>,
    )
    cursor = mention.start + mention.length
  }

  parts.push(text.slice(cursor))

  return (
    <div className={styles.overlay} ref={overlayRef} aria-hidden="true">
      {parts}
      {text.endsWith('\n') ? '\u200b' : null}
    </div>
  )
}
