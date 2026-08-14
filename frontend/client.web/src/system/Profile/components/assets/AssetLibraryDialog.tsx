import type { AssetResponse } from '../../../../shared/types'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import { profileCopy } from '../../../shared/index'
import dialogStyles from '../../../shared/styles/Dialog.module.css'
import styles from './AssetLibraryDialog.module.css'

type AvatarSort = 'newest' | 'oldest'

type AssetLibraryDialogProps = {
  titleId: string
  title: string
  description: string
  emptyText: string
  loadingText: string
  assets: AssetResponse[]
  isLoading: boolean
  sort: AvatarSort
  isRounded?: boolean
  brokenUrls?: Set<string>
  fallbackSrc?: string
  onSortChange: (sort: AvatarSort) => void
  onClose: () => void
  onSelectAsset: (asset: AssetResponse) => void
  onDeleteAsset?: (asset: AssetResponse) => void
  onBrokenUrl?: (url: string) => void
  formatDate: (value: string) => string
}

export function AssetLibraryDialog({
  titleId,
  title,
  description,
  emptyText,
  loadingText,
  assets,
  isLoading,
  sort,
  isRounded = false,
  brokenUrls,
  fallbackSrc,
  onSortChange,
  onClose,
  onSelectAsset,
  onDeleteAsset,
  onBrokenUrl,
  formatDate,
}: AssetLibraryDialogProps) {
  return (
    <div className={dialogStyles.backdrop} role="presentation">
      <section
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.heading}>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label={profileCopy.assets.close}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </div>

        <label className={styles.filter}>
          <span>{profileCopy.assets.sort}</span>
          <select
            name="assetSort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as AvatarSort)}
          >
            <option value="newest">{profileCopy.assets.sortNewest}</option>
            <option value="oldest">{profileCopy.assets.sortOldest}</option>
          </select>
        </label>

        <div
          className={`${styles.list} ${isRounded ? styles.rounded : ''}`}
        >
          {isLoading ? (
            <p>{loadingText}</p>
          ) : assets.length > 0 ? (
            assets.map((asset) => {
              const assetUrl = `/api/assets/${asset.id}/content`
              const imageSrc =
                brokenUrls?.has(assetUrl) && fallbackSrc
                  ? fallbackSrc
                  : assetUrl

              return (
                <div key={asset.id} className={styles.item}>
                  <button
                    className={styles.assetButton}
                    type="button"
                    onClick={() => onSelectAsset(asset)}
                    title={formatDate(asset.createdAt)}
                  >
                    <img
                      className="ui-media-fit"
                      src={imageSrc}
                      alt=""
                      onError={() => onBrokenUrl?.(assetUrl)}
                    />
                  </button>
                  {onDeleteAsset && (
                    <button
                      className={styles.deleteButton}
                      type="button"
                      onClick={() => onDeleteAsset(asset)}
                      aria-label={profileCopy.assets.deleteAsset}
                    >
                      <SystemCloseIcon size="small" />
                    </button>
                  )}
                </div>
              )
            })
          ) : (
            <p>{emptyText}</p>
          )}
        </div>
      </section>
    </div>
  )
}
