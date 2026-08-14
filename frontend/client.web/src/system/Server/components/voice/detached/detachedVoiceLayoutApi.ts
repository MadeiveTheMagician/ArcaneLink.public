import { apiJson, apiNoContent } from '../../../../../shared/api/api'
import {
  normalizeDetachedVoicePreset,
  normalizeDetachedVoiceSlotAspectRatio,
} from './detachedVoiceLayoutModel'
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot,
} from './detachedVoiceLayoutTypes'

type DetachedVoiceLayoutPresetApiResponse = Omit<
  DetachedVoiceLayoutPreset,
  'slots'
> & {
  createdAt: string
  updatedAt: string
  slots: Array<DetachedVoiceLayoutSlot & { id: string }>
}

function mapDetachedVoiceLayoutPresetFromApi(
  preset: DetachedVoiceLayoutPresetApiResponse,
): DetachedVoiceLayoutPreset {
  return normalizeDetachedVoicePreset({
    id: preset.id,
    name: preset.name,
    cellSizePx: preset.cellSizePx,
    gridColumns: preset.gridColumns,
    gridRows: preset.gridRows,
    isPinned: preset.isPinned,
    isPersisted: true,
    showParticipantsWithoutVideo: preset.showParticipantsWithoutVideo,
    hideServiceInfo: preset.hideServiceInfo,
    slots: preset.slots.map((slot) => ({
      index: slot.index,
      preserveAspectRatio: slot.preserveAspectRatio,
      aspectRatio: normalizeDetachedVoiceSlotAspectRatio(
        slot.aspectRatio,
        slot.preserveAspectRatio,
      ),
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      borderRadius: slot.borderRadius,
      zIndex: slot.zIndex,
      mode: slot.mode,
    })),
  })
}

export async function loadDetachedVoiceLayoutPresetsFromApi(accessToken: string) {
  const presets = await apiJson<DetachedVoiceLayoutPresetApiResponse[]>(
    '/api/users/me/voice-layout-presets',
    { accessToken },
  )

  return presets.map(mapDetachedVoiceLayoutPresetFromApi)
}

function createDetachedVoiceLayoutPresetRequest(
  preset: DetachedVoiceLayoutPreset,
) {
  return {
    id: isGuidLike(preset.id) ? preset.id : undefined,
    name: preset.name,
    isPinned: preset.isPinned,
    showParticipantsWithoutVideo: preset.showParticipantsWithoutVideo,
    hideServiceInfo: preset.hideServiceInfo,
    gridColumns: preset.gridColumns,
    gridRows: preset.gridRows,
    cellSizePx: preset.cellSizePx,
    slots: preset.slots.map((slot) => ({
      index: slot.index,
      preserveAspectRatio: slot.preserveAspectRatio,
      aspectRatio: normalizeDetachedVoiceSlotAspectRatio(
        slot.aspectRatio,
        slot.preserveAspectRatio,
      ),
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      borderRadius: slot.borderRadius,
      zIndex: slot.zIndex,
      mode: slot.mode,
    })),
  }
}

export async function saveDetachedVoiceLayoutPresetToApi(
  accessToken: string,
  preset: DetachedVoiceLayoutPreset,
  forceCreate = false,
) {
  const request = createDetachedVoiceLayoutPresetRequest(preset)
  const shouldUpdate = isGuidLike(preset.id) && !forceCreate
  const response = await apiJson<DetachedVoiceLayoutPresetApiResponse>(
    shouldUpdate
      ? `/api/users/me/voice-layout-presets/${preset.id}`
      : '/api/users/me/voice-layout-presets',
    {
      method: shouldUpdate ? 'PUT' : 'POST',
      accessToken,
      body: request,
    },
  )

  return mapDetachedVoiceLayoutPresetFromApi(response)
}

export async function deleteDetachedVoiceLayoutPresetFromApi(
  accessToken: string,
  presetId: string,
) {
  if (!isGuidLike(presetId)) {
    return
  }

  await apiNoContent(`/api/users/me/voice-layout-presets/${presetId}`, {
    method: 'DELETE',
    accessToken,
  })
}

function isGuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

