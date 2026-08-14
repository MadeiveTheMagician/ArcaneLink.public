import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes'

export function getVisibleDetachedVoiceCards(
  cards: VoiceParticipantCard[],
  showParticipantsWithoutVideo: boolean,
  showSelfCamera = true,
) {
  return cards.filter((card) => {
    if (!showSelfCamera && card.isSelf && card.mediaKind === 'camera') {
      return false
    }

    return showParticipantsWithoutVideo || card.hasVideo
  })
}

export function selectDetachedParticipantCard(
  cards: VoiceParticipantCard[],
) {
  return cards.find((card) => card.mediaKind === 'camera') ?? cards[0] ?? null
}
