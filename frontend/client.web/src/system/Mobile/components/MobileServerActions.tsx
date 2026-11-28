import { SystemIcon } from '../../shared'
import styles from './MobileServerActions.module.css'

type Props = {
  onCreateServer: () => void
  onOpenFavorites?: () => void
  createLabel: string
}

export function MobileServerActions({ onCreateServer, onOpenFavorites, createLabel }: Props) {
  return (
    <div className={styles.actions}>
      <button type="button" aria-label={createLabel} onClick={onCreateServer}>
        <SystemIcon name="plus" size={22} />
      </button>
      {onOpenFavorites && (
        <button type="button" aria-label="Избранное" onClick={onOpenFavorites}>
          <span aria-hidden="true">★</span>
        </button>
      )}
    </div>
  )
}
