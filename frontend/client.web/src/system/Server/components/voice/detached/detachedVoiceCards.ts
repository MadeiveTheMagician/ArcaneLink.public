import { getDetachedControlIconCss } from './detachedVoiceIcons'
import { detachedVoiceSlotDefaultBorderRadius } from './detachedVoiceLayoutModel'
import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes'
import { hasActiveVideoTrack } from '../participants/voiceMediaTracks'
import {
  getActiveVoiceParticipantAudioStatuses,
  type VoiceParticipantAudioStatus,
} from '../participants/voiceParticipantCards'

export function createDetachedVoiceCardKey(card: VoiceParticipantCard) {
  return `${card.participant.participantId}:${card.mediaKind}`
}

export function createDetachedVoiceRenderSignature(
  spaceTitle: string,
  cards: VoiceParticipantCard[],
) {
  return JSON.stringify({
    spaceTitle,
    cards: cards.map((card) => ({
      key: createDetachedVoiceCardKey(card),
      displayName: card.participant.displayName,
      hasVideo: card.hasVideo,
      mediaKind: card.mediaKind,
      videoTrackIds:
        card.participantStream
          ?.getVideoTracks()
          .map((track) => `${track.id}:${track.readyState}`)
          .join('|') ?? null,
      avatarAssetId: card.participantMember?.user.avatarAssetId ?? null,
      avatarCropOffsetX: card.participantMember?.user.avatarCropOffsetX ?? 0,
      avatarCropOffsetY: card.participantMember?.user.avatarCropOffsetY ?? 0,
      avatarCropZoom: card.participantMember?.user.avatarCropZoom ?? 1,
    })),
  })
}

function getDetachedAudioStatusIconCss(status: VoiceParticipantAudioStatus) {
  return getDetachedControlIconCss(
    status === 'muted' ? 'mic' : 'headphones',
    false,
  )
}

function syncDetachedCardAudioStatuses(
  container: HTMLElement,
  card: VoiceParticipantCard,
) {
  const activeStatuses = new Set(
    getActiveVoiceParticipantAudioStatuses(card.participant),
  )

  container
    .querySelectorAll<HTMLElement>('[data-detached-audio-status]')
    .forEach((badge) => {
      const status = badge.dataset.detachedAudioStatus as
        | VoiceParticipantAudioStatus
        | undefined
      badge.hidden = !status || !activeStatuses.has(status)
    })

  container.hidden = activeStatuses.size === 0
}

function createDetachedAvatar(
  document: Document,
  card: VoiceParticipantCard,
  accent: string,
) {
  const avatar = document.createElement('span')
  avatar.className = 'arcane-detached-avatar'
  avatar.style.setProperty('--detached-card-accent', accent)

  const user = card.participantMember?.user
  if (user?.avatarAssetId) {
    const image = document.createElement('img')
    image.src = `/api/assets/${user.avatarAssetId}/content`
    image.alt = ''
    image.draggable = false
    image.className = 'arcane-detached-avatar-image'
    image.style.transform = `translate(${(user.avatarCropOffsetX ?? 0) * 100}%, ${
      (user.avatarCropOffsetY ?? 0) * 100
    }%) scale(${user.avatarCropZoom ?? 1})`
    image.addEventListener('error', () => {
      avatar.textContent = card.participant.displayName.slice(0, 1).toUpperCase()
    })
    avatar.append(image)
  } else {
    avatar.textContent = card.participant.displayName.slice(0, 1).toUpperCase()
  }

  return avatar
}

export function createDetachedCardArticle(
  document: Document,
  card: VoiceParticipantCard,
  {
    accent,
    borderRadius = detachedVoiceSlotDefaultBorderRadius,
    cleanupCallbacks,
    hideServiceInfo = false,
    screenSuffix,
  }: {
    accent: string
    borderRadius?: number
    cleanupCallbacks: Array<() => void>
    hideServiceInfo?: boolean
    screenSuffix: string
  },
) {
  const article = document.createElement('article')
  article.className = 'arcane-detached-card'
  article.dataset.cardKey = createDetachedVoiceCardKey(card)
  article.dataset.hideServiceInfo = hideServiceInfo ? 'true' : 'false'
  article.style.setProperty('--detached-card-accent', accent)
  article.style.setProperty(
    '--detached-card-border-alpha',
    hideServiceInfo ? '0.12' : card.isSpeaking ? '0.72' : '0.42',
  )
  article.style.setProperty('--detached-card-radius', `${borderRadius}px`)

  const stream = card.participantStream ?? null
  const hasLiveVideo = hasActiveVideoTrack(stream)

  article.append(createDetachedAvatar(document, card, accent))

  if (stream && hasLiveVideo) {
    const video = document.createElement('video')
    video.autoplay = true
    video.controls = false
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    video.className = 'arcane-detached-card-video'
    video.draggable = false
    article.append(video)
    void video.play().catch(() => undefined)

    const updateVideoState = () => {
      const isLive = hasActiveVideoTrack(stream)

      if (!isLive) {
        video.hidden = true
      }
    }

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', updateVideoState)
      track.addEventListener('mute', updateVideoState)
      track.addEventListener('unmute', updateVideoState)
    })
    cleanupCallbacks.push(() => {
      video.srcObject = null
      stream.getVideoTracks().forEach((track) => {
        track.removeEventListener('ended', updateVideoState)
        track.removeEventListener('mute', updateVideoState)
        track.removeEventListener('unmute', updateVideoState)
      })
    })
  }

  const shade = document.createElement('span')
  shade.className = 'arcane-detached-card-shade'

  const meta = document.createElement('div')
  meta.className = 'arcane-detached-card-meta'

  const name = document.createElement('strong')
  name.textContent = card.mediaKind === 'screen'
    ? `${card.participant.displayName} · ${screenSuffix}`
    : card.participant.displayName
  name.className = 'arcane-detached-card-name'

  const audioStatuses = document.createElement('span')
  audioStatuses.className = 'arcane-detached-audio-statuses'
  audioStatuses.setAttribute('aria-hidden', 'true')
  audioStatuses.dataset.detachedAudioBadge = 'true'
  ;(['muted', 'deafened'] as const).forEach((status) => {
    const audioBadge = document.createElement('span')
    audioBadge.className = 'arcane-detached-audio-badge'
    audioBadge.dataset.detachedAudioStatus = status
    audioBadge.style.background = getDetachedAudioStatusIconCss(status)
    audioStatuses.append(audioBadge)
  })
  syncDetachedCardAudioStatuses(audioStatuses, card)

  meta.append(name)
  if (!hideServiceInfo) {
    article.append(shade, meta)
    article.append(audioStatuses)
  }

  return article
}

export function updateDetachedSpeakingState(
  document: Document,
  cards: VoiceParticipantCard[],
) {
  const cardsByKey = new Map(
    cards.map((card) => [createDetachedVoiceCardKey(card), card]),
  )

  document
    .querySelectorAll<HTMLElement>('[data-card-key]')
    .forEach((article) => {
      const cardKey = article.dataset.cardKey
      const card = cardKey ? cardsByKey.get(cardKey) : null
      if (!card) {
        return
      }

      if (article.dataset.hideServiceInfo === 'true') {
        article.style.setProperty('--detached-card-accent', '184, 184, 184')
        article.style.setProperty('--detached-card-border-alpha', '0.12')
        return
      }

      const isSpeakingProfileCard = card.isSpeaking && card.mediaKind === 'camera'
      const accent = isSpeakingProfileCard ? '80, 214, 143' : card.accent
      article.style.setProperty('--detached-card-accent', accent)
      article.style.setProperty(
        '--detached-card-border-alpha',
        isSpeakingProfileCard ? '0.72' : '0.42',
      )

      const audioStatuses = article.querySelector<HTMLElement>(
        '[data-detached-audio-badge="true"]',
      )
      if (audioStatuses) {
        syncDetachedCardAudioStatuses(audioStatuses, card)
      }
    })
}
