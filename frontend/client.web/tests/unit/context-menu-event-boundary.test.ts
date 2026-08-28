import { expect, test } from '@playwright/test'
import {
  contextMenuBoundaryAttributes,
  isEventInsideContextMenuBoundary,
} from '../../src/system/shared/services/contextMenuEventBoundary'

function eventWithPath(...path: unknown[]) {
  return {
    composedPath: () => path as EventTarget[],
  }
}

function elementWithAttributes(attributes: Record<string, string>) {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
  }
}

test.describe('context menu event boundary', () => {
  test('recognizes events from a nested portal submenu', () => {
    const scrollTarget = elementWithAttributes({})
    const portalSubmenu = elementWithAttributes(contextMenuBoundaryAttributes)

    expect(
      isEventInsideContextMenuBoundary(
        eventWithPath(scrollTarget, portalSubmenu, {}, null),
      ),
    ).toBe(true)
  })

  test('recognizes events from the root menu', () => {
    const menuRoot = elementWithAttributes(contextMenuBoundaryAttributes)

    expect(
      isEventInsideContextMenuBoundary(eventWithPath(menuRoot, {})),
    ).toBe(true)
  })

  test('leaves external page scroll eligible for dismissal', () => {
    const pageScroller = elementWithAttributes({})

    expect(
      isEventInsideContextMenuBoundary(eventWithPath(pageScroller, {}, null)),
    ).toBe(false)
  })

  test('does not treat a false boundary marker as internal', () => {
    const unrelatedElement = elementWithAttributes({
      'data-context-menu-boundary': 'false',
    })

    expect(
      isEventInsideContextMenuBoundary(eventWithPath(unrelatedElement)),
    ).toBe(false)
  })
})
