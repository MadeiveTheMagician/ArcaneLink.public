import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { serverCopy, SystemIcon, useDismissableLayer } from '../../../shared'
import { curatedMessageReactions } from './messageReactionModel'
import styles from './MessageComposerEmojiPicker.module.css'

type MessageComposerEmojiPickerProps = {
  disabled: boolean
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (emoji: string) => void
}

const pickerColumns = 6

export function MessageComposerEmojiPicker({
  disabled,
  isOpen,
  onOpenChange,
  onSelect,
}: MessageComposerEmojiPickerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const emojiButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pickerId = `message-emoji-picker-${useId().replace(/:/g, '')}`
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const closePicker = useCallback(() => onOpenChange(false), [onOpenChange])

  useDismissableLayer({
    isOpen,
    layerRef: pickerRef,
    triggerRef: buttonRef,
    onDismiss: closePicker,
  })

  useLayoutEffect(() => {
    if (!isOpen) return undefined

    function updatePosition() {
      const button = buttonRef.current
      const picker = pickerRef.current
      if (!button || !picker) return

      const gutter = 8
      const buttonBounds = button.getBoundingClientRect()
      const pickerBounds = picker.getBoundingClientRect()
      const width = pickerBounds.width || 280
      const height = pickerBounds.height || 320
      const left = Math.min(
        Math.max(buttonBounds.right - width, gutter),
        Math.max(gutter, window.innerWidth - width - gutter),
      )
      const top =
        buttonBounds.top - height - gutter >= gutter
          ? buttonBounds.top - height - gutter
          : Math.min(
              buttonBounds.bottom + gutter,
              Math.max(gutter, window.innerHeight - height - gutter),
            )

      setPosition((current) =>
        Math.abs(current.left - left) < 0.5 &&
        Math.abs(current.top - top) < 0.5
          ? current
          : { left, top },
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.requestAnimationFrame(() => emojiButtonRefs.current[0]?.focus())

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  function focusEmoji(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      curatedMessageReactions.length - 1,
    )
    setActiveIndex(nextIndex)
    emojiButtonRefs.current[nextIndex]?.focus()
    emojiButtonRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' })
  }

  function handleEmojiKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = Math.min(index + 1, curatedMessageReactions.length - 1)
        break
      case 'ArrowLeft':
        nextIndex = Math.max(index - 1, 0)
        break
      case 'ArrowDown':
        nextIndex = Math.min(
          index + pickerColumns,
          curatedMessageReactions.length - 1,
        )
        break
      case 'ArrowUp':
        nextIndex = Math.max(index - pickerColumns, 0)
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = curatedMessageReactions.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    focusEmoji(nextIndex)
  }

  function selectEmoji(emoji: string) {
    onSelect(emoji)
    onOpenChange(false)
  }

  const pickerStyle = {
    left: position.left,
    top: position.top,
  } as CSSProperties

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.trigger}
        type="button"
        aria-label={serverCopy.messages.addEmoji}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? pickerId : undefined}
        disabled={disabled}
        onClick={() => onOpenChange(!isOpen)}
      >
        <SystemIcon name="smile" size={20} />
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            id={pickerId}
            className={styles.picker}
            role="dialog"
            aria-label={serverCopy.messages.emojiPicker}
            style={pickerStyle}
          >
            <div className={styles.heading}>
              {serverCopy.messages.emojiPicker}
            </div>
            <div
              className={styles.grid}
              role="group"
              aria-label={serverCopy.messages.emojiPicker}
            >
              {curatedMessageReactions.map((reaction, index) => (
                <button
                  key={reaction.emojiCode}
                  ref={(button) => {
                    emojiButtonRefs.current[index] = button
                  }}
                  className={styles.emoji}
                  type="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-label={reaction.label}
                  title={reaction.label}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={(event) => handleEmojiKeyDown(event, index)}
                  onClick={() => selectEmoji(reaction.emojiCode)}
                >
                  <span aria-hidden="true">{reaction.emojiCode}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
