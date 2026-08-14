import { expect, test } from '@playwright/test'
import {
  getMessageComposerHeight,
  getMessageComposerMaximumHeight,
} from '../../src/system/Server/components/messages/messageComposerSizing'

test.describe('message composer sizing', () => {
  test('allows the desktop editor to occupy half of the workspace', () => {
    expect(
      getMessageComposerMaximumHeight({
        isMobile: false,
        lineHeight: 20,
        minimumHeight: 26,
        verticalPadding: 8,
        workspaceHeight: 720,
      }),
    ).toBe(360)
  })

  test('keeps the existing five-line mobile limit', () => {
    expect(
      getMessageComposerMaximumHeight({
        isMobile: true,
        lineHeight: 20,
        minimumHeight: 42,
        verticalPadding: 18,
        workspaceHeight: 720,
      }),
    ).toBe(118)
  })

  test('clamps the editor between its minimum and maximum heights', () => {
    expect(getMessageComposerHeight(18, 26, 360)).toBe(26)
    expect(getMessageComposerHeight(140, 26, 360)).toBe(140)
    expect(getMessageComposerHeight(500, 26, 360)).toBe(360)
  })
})
