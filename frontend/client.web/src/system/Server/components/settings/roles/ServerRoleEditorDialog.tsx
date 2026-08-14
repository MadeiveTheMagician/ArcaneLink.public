import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import type { PermissionResponse } from '../../../../../shared/types'
import { useAnimatedOverlayClose } from '../../../../shared/hooks/useAnimatedOverlayClose'
import { useDismissableLayer } from '../../../../shared/hooks/useDismissableLayer'
import { SystemCloseIcon } from '../../../../shared/icons/components/SystemCloseIcon'
import dialogStyles from '../../../../shared/styles/Dialog.module.css'
import { ServerRoleEditor } from './ServerRoleEditor'
import styles from './ServerRoleEditorDialog.module.css'
import type { ServerRoleSettingsController } from './useServerRoleSettings'

type ServerRoleEditorDialogProps = {
  controller: ServerRoleSettingsController
  permissions: readonly PermissionResponse[]
}

type ServerRoleEditorDialogStyle = CSSProperties & {
  '--server-role-editor-close-duration': string
}

const serverRoleEditorCloseDurationMs = 200
const serverRoleEditorDialogStyle: ServerRoleEditorDialogStyle = {
  '--server-role-editor-close-duration': `${serverRoleEditorCloseDurationMs}ms`,
}

const modalFocusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ServerRoleEditorDialog({
  controller,
  permissions,
}: ServerRoleEditorDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const backButtonRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  const { isClosing, requestClose } = useAnimatedOverlayClose(
    serverRoleEditorCloseDurationMs,
  )
  const closeDialog = useCallback(() => {
    if (!controller.canCloseEditor()) {
      return
    }

    requestClose(controller.closeEditor)
  }, [controller, requestClose])

  useDismissableLayer({
    isOpen: controller.isEditorOpen && !isClosing,
    layerRef: dialogRef,
    onDismiss: closeDialog,
  })

  useEffect(() => {
    if (!controller.isEditorOpen) {
      return undefined
    }

    const restoreFocusElement = restoreFocusRef.current
    const focusFrame = window.requestAnimationFrame(() => {
      backButtonRef.current?.focus()
    })

    function keepFocusInsideDialog(event: KeyboardEvent) {
      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(modalFocusableSelector),
      ).filter((element) => element.getClientRects().length > 0)
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (!firstElement || !lastElement) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const activeElement = document.activeElement
      if (
        event.shiftKey &&
        (activeElement === firstElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', keepFocusInsideDialog)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', keepFocusInsideDialog)

      window.requestAnimationFrame(() => {
        if (restoreFocusElement?.isConnected) {
          restoreFocusElement.focus()
        }
      })
    }
  }, [controller.isEditorOpen])

  const dialogTitle = controller.isCreating
    ? 'Создание роли'
    : 'Редактирование роли'

  return createPortal(
    <div
      className={`${dialogStyles.backdrop} ${styles.backdrop} ${
        isClosing ? styles.backdropClosing : ''
      }`}
      data-state={isClosing ? 'closing' : 'open'}
      role="presentation"
      style={serverRoleEditorDialogStyle}
    >
      <section
        ref={dialogRef}
        className={`${dialogStyles.dialog} ${styles.dialog} ${
          isClosing ? styles.dialogClosing : ''
        }`}
        role="dialog"
        data-server-role-editor-dialog=""
        aria-busy={controller.isMutating}
        aria-modal="true"
        aria-labelledby="server-role-editor-dialog-title"
        tabIndex={-1}
      >
        <header className={styles.heading}>
          <button
            ref={backButtonRef}
            className={styles.backButton}
            type="button"
            disabled={isClosing || controller.isMutating}
            onClick={closeDialog}
          >
            <span aria-hidden="true">←</span>
            Назад
          </button>

          <div className={styles.headingCopy}>
            <span>Настройки сервера</span>
            <h2 id="server-role-editor-dialog-title">{dialogTitle}</h2>
          </div>

          <button
            className={styles.closeButton}
            type="button"
            disabled={isClosing || controller.isMutating}
            aria-label="Закрыть редактор роли"
            onClick={closeDialog}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        <div className={styles.editorBody}>
          <ServerRoleEditor
            controller={controller}
            permissions={permissions}
          />
        </div>
      </section>
    </div>,
    document.body,
  )
}
