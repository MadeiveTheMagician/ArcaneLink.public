export type ModerationEvidenceTransferMode = 'open' | 'download'

export type ModerationEvidenceResponseValidation =
  | { ok: true; mode: ModerationEvidenceTransferMode }
  | { ok: false }

export function isExpectedModerationEvidenceResponseUrl({
  responseUrl,
  requestPath,
  origin,
}: {
  responseUrl: string
  requestPath: string
  origin: string
}) {
  try {
    const baseUrl = new URL(origin)
    const resolvedUrl = new URL(responseUrl, baseUrl)

    return (
      resolvedUrl.origin === baseUrl.origin &&
      resolvedUrl.pathname === requestPath &&
      !resolvedUrl.search &&
      !resolvedUrl.hash &&
      !resolvedUrl.username &&
      !resolvedUrl.password
    )
  } catch {
    return false
  }
}

export function resolveModerationEvidenceContentUrl({
  contentUrl,
  origin,
  serverId,
  caseId,
  evidenceAssetId,
}: {
  contentUrl: string
  origin: string
  serverId: string
  caseId: string
  evidenceAssetId: string
}) {
  if (
    !contentUrl.startsWith('/') ||
    contentUrl.includes('\\') ||
    hasControlCharacters(contentUrl)
  ) {
    return null
  }

  try {
    const baseUrl = new URL(origin)
    const resolvedUrl = new URL(contentUrl, baseUrl)
    const segments = resolvedUrl.pathname.split('/')

    if (
      resolvedUrl.origin !== baseUrl.origin ||
      resolvedUrl.search ||
      resolvedUrl.hash ||
      resolvedUrl.username ||
      resolvedUrl.password ||
      resolvedUrl.pathname.includes('%') ||
      segments.length !== 10 ||
      segments[1] !== 'api' ||
      segments[2] !== 'servers' ||
      !sameIdentifier(segments[3], serverId) ||
      segments[4] !== 'moderation' ||
      segments[5] !== 'cases' ||
      !sameIdentifier(segments[6], caseId) ||
      segments[7] !== 'evidence-assets' ||
      !sameIdentifier(segments[8], evidenceAssetId) ||
      segments[9] !== 'content'
    ) {
      return null
    }

    return resolvedUrl.pathname
  } catch {
    return null
  }
}

export function validateModerationEvidenceResponse({
  recordedMimeType,
  recordedSizeBytes,
  responseContentType,
  responseContentDisposition,
  responseSizeBytes,
}: {
  recordedMimeType: string
  recordedSizeBytes: number
  responseContentType: string | null
  responseContentDisposition: string | null
  responseSizeBytes: number
}): ModerationEvidenceResponseValidation {
  if (
    !Number.isSafeInteger(recordedSizeBytes) ||
    recordedSizeBytes < 0 ||
    responseSizeBytes !== recordedSizeBytes
  ) {
    return { ok: false }
  }

  const contentType = normalizeMimeType(responseContentType)
  const recordedType = normalizeMimeType(recordedMimeType)
  const disposition = responseContentDisposition
    ?.match(/^\s*(inline|attachment)(?:\s*;|\s*$)/i)?.[1]
    ?.toLowerCase()

  if (
    disposition === 'inline' &&
    contentType === recordedType &&
    isSafeInlineMimeType(contentType)
  ) {
    return { ok: true, mode: 'open' }
  }

  if (
    disposition === 'attachment' &&
    contentType === 'application/octet-stream'
  ) {
    return { ok: true, mode: 'download' }
  }

  return { ok: false }
}

export function isMatchingModerationEvidenceSha256(
  expectedSha256: string,
  actualSha256: string,
) {
  const normalizedExpected = expectedSha256.trim().toLowerCase()
  const normalizedActual = actualSha256.trim().toLowerCase()

  return (
    /^[a-f0-9]{64}$/.test(normalizedExpected) &&
    normalizedExpected === normalizedActual
  )
}

export function sanitizeModerationEvidenceFileName(value: string) {
  const sanitized = replaceUnsafeFileNameCharacters(value)
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180)

  return sanitized || 'moderation-evidence'
}

function normalizeMimeType(value: string | null) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function isSafeInlineMimeType(value: string) {
  return (
    (value.startsWith('image/') && value !== 'image/svg+xml') ||
    value.startsWith('video/')
  )
}

function replaceUnsafeFileNameCharacters(value: string) {
  let result = ''
  let previousWasUnsafe = false

  for (const character of value) {
    const isUnsafe =
      isControlCharacter(character) || '\\/:*?"<>|'.includes(character)

    if (isUnsafe) {
      if (!previousWasUnsafe) {
        result += '_'
      }

      previousWasUnsafe = true
      continue
    }

    result += character
    previousWasUnsafe = false
  }

  return result
}

function hasControlCharacters(value: string) {
  return Array.from(value).some(isControlCharacter)
}

function isControlCharacter(value: string) {
  const code = value.charCodeAt(0)
  return code <= 31 || code === 127
}

function sameIdentifier(first: string, second: string) {
  return first.toLowerCase() === second.toLowerCase()
}
