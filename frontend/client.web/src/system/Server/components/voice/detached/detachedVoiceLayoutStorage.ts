import { normalizeDetachedVoicePreset } from './detachedVoiceLayoutModel'
import type { DetachedVoiceLayoutStorage } from './detachedVoiceLayoutTypes'

const detachedVoiceLayoutStorageKey = 'arcanelink.detachedVoiceLayout.v1'

export function loadDetachedVoiceLayoutStorage(): DetachedVoiceLayoutStorage {
  try {
    const raw = window.localStorage.getItem(detachedVoiceLayoutStorageKey)
    if (!raw) {
      return createDefaultDetachedVoiceLayoutStorage()
    }

    const parsed = JSON.parse(raw) as Partial<DetachedVoiceLayoutStorage>

    return {
      version: 1,
      presets: Array.isArray(parsed.presets)
        ? parsed.presets.map(normalizeDetachedVoicePreset)
        : [],
      lastPresetId:
        typeof parsed.lastPresetId === 'string' ? parsed.lastPresetId : null,
      showParticipantsWithoutVideo:
        typeof parsed.showParticipantsWithoutVideo === 'boolean'
          ? parsed.showParticipantsWithoutVideo
          : true,
      showSelfCamera:
        typeof parsed.showSelfCamera === 'boolean'
          ? parsed.showSelfCamera
          : true,
      isTableView:
        typeof parsed.isTableView === 'boolean' ? parsed.isTableView : true,
    }
  } catch {
    return createDefaultDetachedVoiceLayoutStorage()
  }
}

function createDefaultDetachedVoiceLayoutStorage(): DetachedVoiceLayoutStorage {
  return {
    version: 1,
    presets: [],
    lastPresetId: null,
    showParticipantsWithoutVideo: true,
    showSelfCamera: true,
    isTableView: true,
  }
}

export function saveDetachedVoiceLayoutStorage(
  storage: DetachedVoiceLayoutStorage,
) {
  window.localStorage.setItem(
    detachedVoiceLayoutStorageKey,
    JSON.stringify(storage),
  )
}
