export type ServerInviteMessageLink = {
  code: string
  sourceUrl: string
}

export const SERVER_INVITE_MESSAGE_CARD_LIMIT = 3

const absoluteUrlPattern = /https?:\/\/[^\s<>"']+/gi
const trailingPunctuationPattern = /[),.!?;:\]}]+$/
const invitePathPattern = /^\/invite\/([a-z0-9_-]{1,128})$/i

function parseCurrentOrigin(currentOrigin: string) {
  try {
    const url = new URL(currentOrigin)

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    ) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

function parseServerInviteLink(
  value: string,
  currentOrigin: string,
): ServerInviteMessageLink | null {
  try {
    const url = new URL(value)

    if (
      url.origin !== currentOrigin ||
      url.username ||
      url.password
    ) {
      return null
    }

    const pathMatch = invitePathPattern.exec(url.pathname)

    if (!pathMatch) {
      return null
    }

    const code = pathMatch[1].toLowerCase()

    return {
      code,
      sourceUrl: `${currentOrigin}/invite/${encodeURIComponent(code)}`,
    }
  } catch {
    return null
  }
}

export function findServerInviteMessageLinks(
  body: string | null,
  currentOrigin: string,
  limit = SERVER_INVITE_MESSAGE_CARD_LIMIT,
): ServerInviteMessageLink[] {
  if (!body || !Number.isFinite(limit) || limit <= 0) {
    return []
  }

  const origin = parseCurrentOrigin(currentOrigin)

  if (!origin) {
    return []
  }

  const links = new Map<string, ServerInviteMessageLink>()
  const maximum = Math.min(
    SERVER_INVITE_MESSAGE_CARD_LIMIT,
    Math.floor(limit),
  )

  for (const match of body.matchAll(absoluteUrlPattern)) {
    const value = match[0].replace(trailingPunctuationPattern, '')
    const link = parseServerInviteLink(value, origin)

    if (!link || links.has(link.code)) {
      continue
    }

    links.set(link.code, link)

    if (links.size >= maximum) {
      break
    }
  }

  return [...links.values()]
}
