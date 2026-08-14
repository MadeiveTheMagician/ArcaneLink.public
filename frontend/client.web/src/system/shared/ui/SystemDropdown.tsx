import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { SystemIcon } from '../icons/SystemIcon'
import styles from './SystemDropdown.module.css'

export type SystemDropdownOption = {
  value: string
  label: string
  disabled?: boolean
}

type SystemDropdownProps = {
  value: string
  options: SystemDropdownOption[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}

export function SystemDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = '',
}: SystemDropdownProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === value)),
  )
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!isOpen) return undefined

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return
      }

      setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeFromOutside, true)
    return () => document.removeEventListener('pointerdown', closeFromOutside, true)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, isOpen])

  function openDropdown() {
    if (disabled || options.length === 0) return
    setActiveIndex(
      Math.max(0, options.findIndex((option) => option.value === value)),
    )
    setIsOpen(true)
  }

  function selectOption(option: SystemDropdownOption) {
    if (option.disabled) return
    onChange(option.value)
    setIsOpen(false)
  }

  function moveActive(direction: 1 | -1) {
    if (options.length === 0) return

    let nextIndex = activeIndex
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length
      if (!options[nextIndex]?.disabled) {
        setActiveIndex(nextIndex)
        return
      }
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const indices = options.map((_, index) => index)
      const available = indices.filter((index) => !options[index]?.disabled)
      setActiveIndex(event.key === 'Home' ? available[0] ?? 0 : available.at(-1) ?? 0)
      return
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div className={`${styles.root} ${className}`} ref={rootRef}>
      <button
        className={styles.trigger}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled || options.length === 0}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openDropdown()
          }
        }}
      >
        <span>{selectedOption?.label ?? ''}</span>
        <SystemIcon
          className={isOpen ? styles.openIcon : styles.icon}
          name="chevron-down"
          size={16}
        />
      </button>

      {isOpen && (
        <div className={styles.menu} id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <button
                className={`${styles.option} ${isSelected ? styles.selectedOption : ''}`}
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => selectOption(option)}
                onKeyDown={handleOptionKeyDown}
              >
                <span>{option.label}</span>
                {isSelected && <SystemIcon name="check" size={16} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
