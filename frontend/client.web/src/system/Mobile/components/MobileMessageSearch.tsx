import { useId, useRef, useState, type ComponentProps } from 'react'
import { SystemIcon } from '../../shared/icons/SystemIcon'
import { useDismissableLayer } from '../../shared/hooks/useDismissableLayer'
import { MessageSearchControl } from '../../shared/components/message-search/MessageSearchControl'
import { MessageSearchResults } from '../../shared/components/message-search/MessageSearchResults'
import styles from './MobileMessageSearch.module.css'

type Props = {
  control: ComponentProps<typeof MessageSearchControl>
  results?: ComponentProps<typeof MessageSearchResults>
}

export function MobileMessageSearch({ control, results }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useDismissableLayer({ isOpen, layerRef: panelRef, triggerRef, onDismiss: () => setIsOpen(false) })

  return (
    <div className={styles.search}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        type="button"
        aria-label={control.ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <SystemIcon name="search" size={18} />
      </button>
      {isOpen && (
        <div ref={panelRef} id={panelId} className={styles.panel} role="region" aria-label={control.ariaLabel}>
          <MessageSearchControl {...control} name={`${control.name}Mobile`} autoFocus openFiltersOnFocus={false} />
          {results && (
            <div className={styles.results}>
              <MessageSearchResults {...results} onOpenMessage={(message) => {
                results.onOpenMessage(message)
                setIsOpen(false)
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
