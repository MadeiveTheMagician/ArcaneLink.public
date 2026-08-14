import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ImageCropEditor } from '../../../../shared/media/ImageCropEditor'
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor'
import dialogStyles from '../../../shared/styles/Dialog.module.css'
import styles from './AssetCropDialog.module.css'

const closeAnimationDurationMs = 180

type AssetCropDialogProps = {
  imageUrl: string
  title: string
  description: string
  shape: 'circle' | 'square' | 'rounded'
  aspectRatio: string
  frameLabel: string
  initialCrop?: ImageCrop
  isSaving: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (crop: ImageCrop) => void
  onImageError?: () => void
}

export function AssetCropDialog({
  imageUrl,
  title,
  description,
  shape,
  aspectRatio,
  frameLabel,
  initialCrop,
  isSaving,
  error,
  onCancel,
  onConfirm,
  onImageError,
}: AssetCropDialogProps) {
  const [isClosing, setIsClosing] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const isClosingRef = useRef(false)

  const requestClose = useCallback(() => {
    if (isSaving || isClosingRef.current) {
      return
    }

    isClosingRef.current = true

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCancel()
      return
    }

    setIsClosing(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null
      onCancel()
    }, closeAnimationDurationMs)
  }, [isSaving, onCancel])

  useEffect(() => {
    function closeByEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
      }
    }

    window.addEventListener('keydown', closeByEscape)
    return () => window.removeEventListener('keydown', closeByEscape)
  }, [requestClose])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className={`${dialogStyles.backdrop} ${styles.backdrop} ${
        isClosing ? styles.closing : ''
      }`}
      role="presentation"
      onMouseDown={requestClose}
    >
      <section
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-busy={isSaving || isClosing}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ImageCropEditor
          key={imageUrl}
          imageUrl={imageUrl}
          title={title}
          description={description}
          shape={shape}
          aspectRatio={aspectRatio}
          frameLabel={frameLabel}
          initialCrop={initialCrop}
          isSaving={isSaving}
          isInteractionDisabled={isClosing}
          error={error}
          onCancel={requestClose}
          onConfirm={onConfirm}
          onImageError={onImageError}
        />
      </section>
    </div>
  )
}
