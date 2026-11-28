import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { ServerMemberDetailsResponse } from '../../../../shared/types'
import type { VoiceParticipant } from '../../hooks/voice/useVoiceChannel'
import { SystemIcon } from '../../../shared'
import {
  getVoiceParticipantMember,
  VoiceParticipantAvatar,
} from '../voice/participants/VoiceParticipantIdentity'
import styles from './ServerTooltip.module.css'

const showDelayMs = 0
const viewportGutter = 8
const anchorGap = 10
const visibleParticipantLimit = 4

type ServerTooltipProps = {
  anchorRef: RefObject<HTMLElement | null>
  id: string
  isOpen: boolean
  members?: ServerMemberDetailsResponse[]
  participants?: VoiceParticipant[]
  serverTitle: string
  serverNames?: string[]
}

export function ServerTooltip({
  anchorRef,
  id,
  isOpen,
  members = [],
  participants = [],
  serverTitle,
  serverNames,
}: ServerTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false)
      return
    }

    const showTimer = window.setTimeout(() => setIsVisible(true), showDelayMs)
    return () => window.clearTimeout(showTimer)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isVisible) return

    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    if (!anchor || !tooltip) return

    const anchorRect = anchor.getBoundingClientRect()
    const tooltipHeight = tooltip.offsetHeight
    const preferredLeft = anchorRect.right + anchorGap
    const preferredTop = anchorRect.top + (anchorRect.height - tooltipHeight) / 2

    setPosition({
      left: Math.max(viewportGutter, Math.min(preferredLeft, window.innerWidth - tooltip.offsetWidth - viewportGutter)),
      top: Math.max(viewportGutter, Math.min(preferredTop, window.innerHeight - tooltipHeight - viewportGutter)),
    })
  }, [anchorRef, isVisible, participants.length, serverNames, serverTitle])

  if (!isVisible) return null

  const visibleParticipants = participants.slice(0, visibleParticipantLimit)
  const hasOverflow = participants.length > visibleParticipantLimit

  return createPortal(
    <div
      ref={tooltipRef}
      className={styles.tooltip}
      id={id}
      role="tooltip"
      style={position}
    >
      <strong className={styles.title}>{serverTitle}</strong>
      {serverNames && (
        <ul className={styles.serverNames} role="list">
          {serverNames.map((name, index) => <li key={index}>{name}</li>)}
        </ul>
      )}
      {participants.length > 0 && (
        <span
          className={styles.participants}
          aria-label={`${participants.length} active voice participants`}
        >
          {visibleParticipants.map((participant) => (
            <VoiceParticipantAvatar
              key={participant.participantId}
              className={styles.avatar}
              participant={participant}
              member={getVoiceParticipantMember(participant, members)}
            />
          ))}
          {hasOverflow && (
            <span className={styles.overflow} aria-hidden="true">
              <span className={styles.overflowIcon}>
                <SystemIcon name="friends" size={13} />
              </span>
            </span>
          )}
        </span>
      )}
    </div>,
    document.body,
  )
}
