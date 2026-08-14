import { voiceCopy } from '../../../shared/copy/voice.ru'

const codecSeparatorPattern = /\s*(?:\u00b7|\u0412\u00b7)\s*/

/**
 * WebRTC exposes its codec metadata with English technical unit suffixes.
 * Keep the codec name intact, but translate the user-facing units here so the
 * runtime collector can remain presentation-agnostic.
 */
export function formatVoiceCodecLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  return normalized
    .split(codecSeparatorPattern)
    .map((part) => localizeCodecPart(part.trim()))
    .filter(Boolean)
    .join(' · ')
}

function localizeCodecPart(part: string) {
  const clockRateMatch = /^(\d+(?:[.,]\d+)?)\s*kHz$/i.exec(part)
  if (clockRateMatch) {
    return `${clockRateMatch[1]} ${voiceCopy.dock.kilohertzShort}`
  }

  const channelCountMatch = /^(\d+)\s*ch$/i.exec(part)
  if (channelCountMatch) {
    return `${channelCountMatch[1]} ${voiceCopy.dock.channelsShort}`
  }

  return part
}
