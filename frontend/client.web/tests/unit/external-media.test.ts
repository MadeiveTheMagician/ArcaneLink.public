import { expect, test } from '@playwright/test';

import { findExternalMedia } from '../../src/system/Server/components/messages/externalMedia';

test.describe('external message media', () => {
  test('recognizes regular YouTube videos and vertical Shorts', () => {
    const previews = findExternalMedia(
      'Обычное https://www.youtube.com/watch?v=oG0iGSAk088 и short https://youtube.com/shorts/abcdefghijk'
    );

    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({
      provider: 'youtube',
      format: 'landscape',
      embedUrl: 'https://www.youtube-nocookie.com/embed/oG0iGSAk088'
    });
    expect(previews[1]).toMatchObject({
      provider: 'youtube',
      format: 'portrait',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
      title: 'YouTube Shorts'
    });
  });

  test('keeps shared Shorts URLs portrait without affecting short YouTube links', () => {
    const previews = findExternalMedia(
      'https://www.youtube.com/shorts/abcdefghijk?si=share-token https://youtu.be/zyxwvutsrqp'
    );

    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({
      provider: 'youtube',
      format: 'portrait',
      title: 'YouTube Shorts'
    });
    expect(previews[1]).toMatchObject({
      provider: 'youtube',
      format: 'landscape',
      title: 'YouTube'
    });
  });

  test('recognizes Twitch videos, clips and channels', () => {
    const previews = findExternalMedia(
      'https://www.twitch.tv/videos/123456 https://clips.twitch.tv/FancyClip https://twitch.tv/arcanelink'
    );

    expect(previews).toHaveLength(3);
    expect(previews.every((preview) => preview.provider === 'twitch')).toBe(
      true
    );
    expect(previews.every((preview) => preview.format === 'landscape')).toBe(
      true
    );
    expect(previews[0].embedUrl).toContain('video=v123456');
    expect(previews[1].embedUrl).toContain('clip=FancyClip');
    expect(previews[2].embedUrl).toContain('channel=arcanelink');
  });

  test('ignores unsupported hosts and deduplicates the same video', () => {
    const previews = findExternalMedia(
      'https://example.com/video https://youtu.be/oG0iGSAk088 https://youtube.com/watch?v=oG0iGSAk088'
    );

    expect(previews).toHaveLength(1);
    expect(previews[0].provider).toBe('youtube');
  });
});
