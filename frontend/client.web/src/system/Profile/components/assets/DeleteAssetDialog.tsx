import buttonStyles from '../../../shared/styles/Button.module.css'
import { profileCopy } from '../../../shared/index'
import dialogStyles from '../../../shared/styles/Dialog.module.css'
import styles from './DeleteAssetDialog.module.css'

type DeleteAssetDialogProps = {
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteAssetDialog({
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteAssetDialogProps) {
  return (
    <div className={dialogStyles.backdrop} role="presentation">
      <section
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-avatar-title"
      >
        <h2 id="delete-avatar-title">{profileCopy.assets.deleteTitle}</h2>
        <p>{profileCopy.assets.deleteDescription}</p>
        <div className={dialogStyles.actions}>
          <button
            className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.button} ${styles.secondary}`}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {profileCopy.assets.deleteCancel}
          </button>
          <button
            className={`${buttonStyles.button} ${buttonStyles.danger} ${styles.button}`}
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting
              ? profileCopy.assets.deleteLoading
              : profileCopy.assets.deleteConfirm}
          </button>
        </div>
      </section>
    </div>
  )
}
