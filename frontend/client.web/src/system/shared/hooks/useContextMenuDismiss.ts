import { useEffect } from 'react';

import { isEventInsideContextMenuBoundary } from '../services/contextMenuEventBoundary';

export function useContextMenuDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeByExternalPointer(event: MouseEvent) {
      if (!isEventInsideContextMenuBoundary(event)) {
        onClose();
      }
    }

    function closeByKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    function closeByExternalScroll(event: Event) {
      if (!isEventInsideContextMenuBoundary(event)) {
        onClose();
      }
    }

    window.addEventListener('click', closeByExternalPointer);
    window.addEventListener('contextmenu', closeByExternalPointer);
    window.addEventListener('keydown', closeByKey);
    window.addEventListener('scroll', closeByExternalScroll, true);

    return () => {
      window.removeEventListener('click', closeByExternalPointer);
      window.removeEventListener('contextmenu', closeByExternalPointer);
      window.removeEventListener('keydown', closeByKey);
      window.removeEventListener('scroll', closeByExternalScroll, true);
    };
  }, [isOpen, onClose]);
}
