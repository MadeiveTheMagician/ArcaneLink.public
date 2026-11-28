import type { ReactNode } from 'react'
import { useMobileSpaceContextMenu } from '../../../Mobile/hooks/useMobileSpaceContextMenu'
import { SystemIcon } from '../../../shared'
import styles from './FavoriteSpacesView.module.css'

type Props = {
  title: string
  kind: 'text' | 'voice' | 'category'
  isCurrent: boolean
  onOpen?: () => void
  onOpenMenu: (x: number, y: number, autoFocus: boolean) => void
  trailingAction?: ReactNode
}

export function FavoriteSpaceRow({ title, kind, isCurrent, onOpen, onOpenMenu, trailingAction }: Props) {
  const { suppressTap, ...menuHandlers } = useMobileSpaceContextMenu(onOpenMenu)
  return (
    <div className={styles.row}>
      <button
        {...menuHandlers}
        type="button"
        className={styles.spaceLink}
        data-kind={kind}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={(event) => {
          if (suppressTap(event.detail)) return
          if (onOpen) {
            onOpen()
            return
          }
          const bounds = event.currentTarget.getBoundingClientRect()
          onOpenMenu(bounds.left, bounds.bottom, event.detail === 0)
        }}
      >
        <span className={styles.spaceIcon} aria-hidden="true">
          {kind === 'text' ? '#' : <SystemIcon name={kind === 'voice' ? 'speaker' : 'folder'} size={18} />}
        </span>
        <span className={styles.spaceTitle}>{title}</span>
      </button>
      {trailingAction}
    </div>
  )
}
