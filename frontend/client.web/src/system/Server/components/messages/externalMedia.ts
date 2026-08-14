export type ExternalMediaPreview = {
  id: string
  provider: 'youtube' | 'twitch'
  format: 'landscape' | 'portrait'
  sourceUrl: string
  embedUrl: string
  thumbnailUrl?: string
  title: string
}

const urlPattern = /https?:\/\/[^\s<]+/gi
const trailingPunctuationPattern = /[),.!?;:]+$/

function parseYouTubeUrl(url: URL): ExternalMediaPreview | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let videoId: string | null = null
  let format: ExternalMediaPreview['format'] = 'landscape'

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    const segments = url.pathname.split('/').filter(Boolean)

    if (segments[0] === 'shorts') {
      videoId = segments[1] ?? null
      format = 'portrait'
    } else if (segments[0] === 'embed') {
      videoId = segments[1] ?? null
    } else if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v')
    }
  }

  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    return null
  }

  const start = url.searchParams.get('t') ?? url.searchParams.get('start')
  const startQuery = start && /^\d+$/.test(start) ? `?start=${start}` : ''

  return {
    id: `youtube:${videoId}`,
    provider: 'youtube',
    format,
    sourceUrl: url.toString(),
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}${startQuery}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    title: format === 'portrait' ? 'YouTube Shorts' : 'YouTube',
  }
}

function parseTwitchUrl(
  url: URL,
  parentHost: string,
): ExternalMediaPreview | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const segments = url.pathname.split('/').filter(Boolean)
  const parent = parentHost || 'localhost'
  let id: string | null = null
  let embedUrl: string | null = null

  if (host === 'clips.twitch.tv') {
    id = segments[0] ?? null
    embedUrl = id
      ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${encodeURIComponent(parent)}`
      : null
  } else if (host === 'twitch.tv' || host === 'm.twitch.tv') {
    if (segments[0] === 'videos' && /^\d+$/.test(segments[1] ?? '')) {
      id = segments[1]
      embedUrl = `https://player.twitch.tv/?video=v${id}&parent=${encodeURIComponent(parent)}`
    } else if (segments[1] === 'clip' && /^[\w-]+$/.test(segments[2] ?? '')) {
      id = segments[2]
      embedUrl = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${encodeURIComponent(parent)}`
    } else if (segments[0] && /^[\w]+$/.test(segments[0])) {
      id = segments[0]
      embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(id)}&parent=${encodeURIComponent(parent)}`
    }
  }

  if (!id || !embedUrl) {
    return null
  }

  return {
    id: `twitch:${id}`,
    provider: 'twitch',
    format: 'landscape',
    sourceUrl: url.toString(),
    embedUrl,
    title: 'Twitch',
  }
}

export function findExternalMedia(
  body: string | null,
  parentHost = 'localhost',
): ExternalMediaPreview[] {
  if (!body) {
    return []
  }

  const previews = new Map<string, ExternalMediaPreview>()

  for (const match of body.matchAll(urlPattern)) {
    const value = match[0].replace(trailingPunctuationPattern, '')

    try {
      const url = new URL(value)
      const preview = parseYouTubeUrl(url) ?? parseTwitchUrl(url, parentHost)

      if (preview) {
        previews.set(preview.id, preview)
      }
    } catch {
      // A malformed URL remains ordinary message text.
    }
  }

  return [...previews.values()]
}
