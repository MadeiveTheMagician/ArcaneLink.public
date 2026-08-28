import { useState } from 'react'
import type { PrivateSpaceResponse } from '../../../../shared/types'
import type { PrivateCallState } from '../../../Server/hooks/voice/voiceChannelTypes'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import { PrivateSpaceAvatar } from '../direct-messages/DirectMessageAvatar'
import { getPrivateSpaceTitle } from '../direct-messages/directMessageModel'
import { privateCallCopy } from './privateCallCopy.ru'
import styles from './PrivateCallNotificationStack.module.css'

type PrivateCallNotificationStackProps = {
  calls: PrivateCallState[]
  currentUserId: string
  privateSpaces: PrivateSpaceResponse[]
  onAccept: (call: PrivateCallState, title: string) => Promise<void>
  onDecline: (call: PrivateCallState) => Promise<boolean>
}

export function PrivateCallNotificationStack({
  calls,
  currentUserId,
  privateSpaces,
  onAccept,
  onDecline,
}: PrivateCallNotificationStackProps) {
  const [pendingActionByCallId, setPendingActionByCallId] = useState<
    Record<string, 'accept' | 'decline'>
  >({})
  const [errorCallIds, setErrorCallIds] = useState<Set<string>>(() => new Set())

  if (!calls.length) return null

  async function runAction(
    call: PrivateCallState,
    action: 'accept' | 'decline',
    title: string,
  ) {
    const callId = call.callId.toLowerCase()
    setPendingActionByCallId((current) => ({ ...current, [callId]: action }))
    setErrorCallIds((current) => {
      const next = new Set(current)
      next.delete(callId)
      return next
    })
    try {
      if (action === 'accept') await onAccept(call, title)
      else if (!(await onDecline(call))) throw new Error('decline-failed')
    } catch {
      setErrorCallIds((current) => new Set(current).add(callId))
    } finally {
      setPendingActionByCallId((current) => {
        const next = { ...current }
        delete next[callId]
        return next
      })
    }
  }

  return (
    <aside
      className={styles.stack}
      aria-label={privateCallCopy.stackLabel}
      aria-live="assertive"
    >
      {calls.map((call) => {
        const space = privateSpaces.find(
          (item) => item.spaceId.toLowerCase() === call.spaceId.toLowerCase(),
        )
        const title = space
          ? getPrivateSpaceTitle(space, currentUserId)
          : call.caller.displayName
        const callId = call.callId.toLowerCase()
        const pendingAction = pendingActionByCallId[callId]

        return (
          <article className={styles.card} key={call.callId}>
            {space ? (
              <PrivateSpaceAvatar
                className={styles.avatar}
                space={space}
                currentUserId={currentUserId}
                title={title}
              />
            ) : (
              <span className={styles.avatar} aria-hidden="true">
                {call.caller.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className={styles.content}>
              <span className={styles.eyebrow}>
                <SystemIcon name="phone" size={16} />
                {privateCallCopy.incomingTitle}
              </span>
              <strong>{call.caller.displayName}</strong>
              <p>
                {space?.kind === 'group'
                  ? privateCallCopy.groupDescription(title)
                  : privateCallCopy.directDescription}
              </p>
              {errorCallIds.has(callId) ? (
                <span className={styles.error}>{privateCallCopy.unavailable}</span>
              ) : null}
              <div className={styles.actions}>
                <button
                  className={styles.decline}
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void runAction(call, 'decline', title)}
                >
                  {pendingAction === 'decline'
                    ? privateCallCopy.declining
                    : privateCallCopy.decline}
                </button>
                <button
                  className={styles.accept}
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void runAction(call, 'accept', title)}
                >
                  {pendingAction === 'accept'
                    ? privateCallCopy.accepting
                    : privateCallCopy.accept}
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </aside>
  )
}
