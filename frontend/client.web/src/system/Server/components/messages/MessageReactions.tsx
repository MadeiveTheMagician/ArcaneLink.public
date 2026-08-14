import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { SpaceMessageResponse } from '../../../../shared/types'
import { serverCopy } from '../../../shared'
import styles from './MessageReactions.module.css'
import {
  completeReactionPresenceAnimation,
  createReactionPresenceState,
  reconcileReactionPresence,
  shouldAddMessageReaction,
  type ReactionPresenceItem,
  type ReactionPresenceState,
} from './messageReactionModel'

type MessageReactionsProps = {
  message: SpaceMessageResponse
  canReact: boolean
  onSetReaction: (
    messageId: string,
    emojiCode: string,
    isPresent: boolean,
  ) => Promise<SpaceMessageResponse | null>
}

type ReactionPresenceAction =
  | {
      type: 'reconcile'
      messageId: string
      reactions: SpaceMessageResponse['reactions']
    }
  | {
      type: 'complete'
      messageId: string
      emojiCode: string
      token: number
    }

function reactionPresenceReducer(
  state: ReactionPresenceState,
  action: ReactionPresenceAction,
) {
  if (action.type === 'reconcile') {
    return reconcileReactionPresence(
      state,
      action.messageId,
      action.reactions,
    )
  }

  return completeReactionPresenceAnimation(
    state,
    action.messageId,
    action.emojiCode,
    action.token,
  )
}

type ReactionChipProps = {
  item: ReactionPresenceItem
  messageId: string
  disabled: boolean
  onToggle: (emojiCode: string) => void
  onAnimationComplete: (
    messageId: string,
    emojiCode: string,
    token: number,
  ) => void
}

function ReactionChip({
  item,
  messageId,
  disabled,
  onToggle,
  onAnimationComplete,
}: ReactionChipProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const { reaction, phase, token } = item
  const isExiting = phase === 'exiting'

  useEffect(() => {
    if (phase === 'present') {
      return
    }

    if (isExiting) {
      buttonRef.current?.blur()
    }

    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const timeoutId = window.setTimeout(
      () => onAnimationComplete(messageId, reaction.emojiCode, token),
      prefersReducedMotion ? 0 : phase === 'entering' ? 240 : 220,
    )

    return () => window.clearTimeout(timeoutId)
  }, [
    isExiting,
    messageId,
    onAnimationComplete,
    phase,
    reaction.emojiCode,
    token,
  ])

  const phaseClass = phase === 'entering'
    ? styles.reactionChipEntering
    : isExiting
      ? styles.reactionChipExiting
      : ''

  return (
    <button
      ref={buttonRef}
      className={`${styles.reactionChip} ${
        reaction.reactedByCurrentUser ? styles.reactionChipActive : ''
      } ${phaseClass}`}
      type="button"
      aria-hidden={isExiting || undefined}
      aria-pressed={reaction.reactedByCurrentUser}
      aria-label={serverCopy.messages.toggleReaction(
        reaction.emojiCode,
        reaction.count,
      )}
      disabled={disabled || isExiting}
      tabIndex={isExiting ? -1 : undefined}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          onAnimationComplete(messageId, reaction.emojiCode, token)
        }
      }}
      onClick={() => onToggle(reaction.emojiCode)}
    >
      <span aria-hidden="true">{reaction.emojiCode}</span>
      <span>{reaction.count}</span>
    </button>
  )
}

export function MessageReactions({
  message,
  canReact,
  onSetReaction,
}: MessageReactionsProps) {
  const [pendingEmojiCode, setPendingEmojiCode] = useState<string | null>(null)
  const [presenceState, dispatchPresence] = useReducer(
    reactionPresenceReducer,
    {
      messageId: message.id,
      reactions: message.reactions,
    },
    ({ messageId, reactions }) =>
      createReactionPresenceState(messageId, reactions),
  )
  const isDisabled = !canReact || Boolean(message.deletedAt)

  useLayoutEffect(() => {
    dispatchPresence({
      type: 'reconcile',
      messageId: message.id,
      reactions: message.reactions,
    })
  }, [message.id, message.reactions])

  const completeAnimation = useCallback((
    messageId: string,
    emojiCode: string,
    token: number,
  ) => {
    dispatchPresence({
      type: 'complete',
      messageId,
      emojiCode,
      token,
    })
  }, [])

  async function toggleReaction(emojiCode: string) {
    if (isDisabled || pendingEmojiCode) {
      return
    }

    setPendingEmojiCode(emojiCode)
    try {
      await onSetReaction(
        message.id,
        emojiCode,
        shouldAddMessageReaction(message.reactions, emojiCode),
      )
    } finally {
      setPendingEmojiCode(null)
    }
  }

  if (presenceState.items.length === 0) {
    return null
  }

  return (
    <div className={styles.reactionArea}>
      <div
        className={styles.reactionList}
        role="group"
        aria-label={serverCopy.messages.reactions}
        aria-busy={pendingEmojiCode != null}
      >
        {presenceState.items.map((item) => (
          <ReactionChip
            key={item.reaction.emojiCode}
            item={item}
            messageId={presenceState.messageId}
            disabled={isDisabled || pendingEmojiCode != null}
            onToggle={(emojiCode) => void toggleReaction(emojiCode)}
            onAnimationComplete={completeAnimation}
          />
        ))}
      </div>
    </div>
  )
}
