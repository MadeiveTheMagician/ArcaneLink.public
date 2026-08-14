import { useEffect } from 'react'

export function useContextMenuDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function closeByPointer() {
      onClose()
    }

    function closeByKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    function closeByExternalScroll(event: Event) {
      const scrollStartedInsideContextMenu = event
        .composedPath()
        .some(
          (target) =>
            target instanceof HTMLElement &&
            target.dataset.contextMenuRoot === 'true',
        )

      if (!scrollStartedInsideContextMenu) {
        onClose()
      }
    }

    window.addEventListener('click', closeByPointer)
    window.addEventListener('contextmenu', closeByPointer)
    window.addEventListener('keydown', closeByKey)
    window.addEventListener('scroll', closeByExternalScroll, true)

    return () => {
      window.removeEventListener('click', closeByPointer)
      window.removeEventListener('contextmenu', closeByPointer)
      window.removeEventListener('keydown', closeByKey)
      window.removeEventListener('scroll', closeByExternalScroll, true)
    }
  }, [isOpen, onClose])
}
