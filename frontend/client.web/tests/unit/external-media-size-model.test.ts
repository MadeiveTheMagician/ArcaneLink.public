import { expect, test } from '@playwright/test'
import {
  getExternalMediaPreviewListWidth,
  getHorizontalExternalMediaCardWidth,
  getPortraitExternalMediaBackdropWidth,
  getVerticalExternalMediaCardWidth,
  resolveExternalMediaBubbleWidth,
  resolveExternalMediaPreviewLayout,
} from '../../src/system/Server/components/messages/externalMediaSizeModel'

test.describe('external media size model', () => {
  test('maps every configured horizontal and vertical size', () => {
    expect(
      Array.from({ length: 6 }, (_, index) =>
        getHorizontalExternalMediaCardWidth(index + 1),
      ),
    ).toEqual([400, 520, 640, 760, 880, 1000])
    expect(
      Array.from({ length: 6 }, (_, index) =>
        getVerticalExternalMediaCardWidth(index + 1),
      ),
    ).toEqual([220, 270, 320, 370, 420, 470])
  })

  test('clamps invalid settings', () => {
    expect(getHorizontalExternalMediaCardWidth(-4)).toBe(400)
    expect(getHorizontalExternalMediaCardWidth(99)).toBe(1000)
    expect(getVerticalExternalMediaCardWidth(3.6)).toBe(370)
  })

  test('uses the vertical size for the Shorts player and adds a Bubble backdrop', () => {
    const portrait = {
      id: 'youtube:abcdefghijk',
      provider: 'youtube',
      format: 'portrait',
      sourceUrl: 'https://youtube.com/shorts/abcdefghijk',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      title: 'YouTube Shorts',
    } as const
    const landscape = {
      ...portrait,
      id: 'youtube:zyxwvutsrqp',
      format: 'landscape',
      title: 'YouTube',
    } as const

    expect(resolveExternalMediaPreviewLayout(portrait, 6, 2, true)).toEqual({
      cardWidth: 480,
      playerWidth: 270,
      isPortrait: true,
      shouldCenter: true,
      shouldUseBackdrop: true,
    })
    expect(resolveExternalMediaPreviewLayout(portrait, 6, 2, false)).toEqual({
      cardWidth: 270,
      playerWidth: 270,
      isPortrait: true,
      shouldCenter: false,
      shouldUseBackdrop: false,
    })
    expect(resolveExternalMediaPreviewLayout(landscape, 6, 2, true)).toEqual({
      cardWidth: 1000,
      playerWidth: 1000,
      isPortrait: false,
      shouldCenter: false,
      shouldUseBackdrop: false,
    })
    expect(getPortraitExternalMediaBackdropWidth(270)).toBe(480)
  })

  test('uses only actual preview formats for the bubble override', () => {
    expect(
      resolveExternalMediaBubbleWidth({
        body: 'Landscape https://youtu.be/abc12345',
        enabled: true,
        parentHost: 'localhost',
        horizontalSize: 6,
        verticalSize: 1,
      }),
    ).toBe(1000)
    expect(
      resolveExternalMediaBubbleWidth({
        body: 'Portrait https://youtube.com/shorts/abc12345',
        enabled: true,
        parentHost: 'localhost',
        horizontalSize: 6,
        verticalSize: 2,
      }),
    ).toBe(480)
  })

  test('widens only Bubble Shorts lists for the non-interactive backdrop', () => {
    const portrait = {
      id: 'youtube:abcdefghijk',
      provider: 'youtube',
      format: 'portrait',
      sourceUrl: 'https://youtube.com/shorts/abcdefghijk',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      title: 'YouTube Shorts',
    } as const

    expect(getExternalMediaPreviewListWidth([portrait], 6, 2)).toBe(270)
    expect(getExternalMediaPreviewListWidth([portrait], 6, 2, true)).toBe(480)
  })

  test('does not override the bubble for ordinary text or disabled previews', () => {
    expect(
      resolveExternalMediaBubbleWidth({
        body: 'A regular long message without supported links',
        enabled: true,
        parentHost: 'localhost',
        horizontalSize: 6,
        verticalSize: 6,
      }),
    ).toBeNull()
    expect(
      resolveExternalMediaBubbleWidth({
        body: 'https://youtu.be/abc12345',
        enabled: false,
        parentHost: 'localhost',
        horizontalSize: 6,
        verticalSize: 6,
      }),
    ).toBeNull()
    expect(getExternalMediaPreviewListWidth([], 6, 6)).toBeNull()
  })
})
