export const contextMenuBoundaryAttributes = {
  'data-context-menu-boundary': 'true',
} as const

type AttributeReader = {
  getAttribute: (name: string) => string | null
}

function canReadAttributes(target: unknown): target is AttributeReader {
  return (
    typeof target === 'object' &&
    target !== null &&
    'getAttribute' in target &&
    typeof target.getAttribute === 'function'
  )
}

/**
 * Context-menu submenus are rendered into document.body through portals, so
 * DOM containment by the root menu cannot identify all internal events. Every
 * menu surface marks itself as a boundary and the composed event path bridges
 * those portal boundaries for pointer and scroll dismissal alike.
 */
export function isEventInsideContextMenuBoundary(
  event: Pick<Event, 'composedPath'>,
) {
  return event.composedPath().some(
    (target) =>
      canReadAttributes(target) &&
      target.getAttribute('data-context-menu-boundary') === 'true',
  )
}
