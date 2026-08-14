import { useCallback, useSyncExternalStore } from 'react'
import {
  defaultVoiceSettings,
  getVoiceSettings,
  resetVoiceSettings,
  subscribeVoiceSettings,
  updateVoiceSettings,
} from './voiceSettings'
import type { VoiceSettings } from './voiceSettings'

const getServerVoiceSettings = () => defaultVoiceSettings as VoiceSettings

export function useVoiceSettings() {
  const settings = useSyncExternalStore(
    (onStoreChange) => subscribeVoiceSettings(() => onStoreChange()),
    getVoiceSettings,
    getServerVoiceSettings,
  )

  const updateSettings = useCallback((patch: Partial<VoiceSettings>) => {
    return updateVoiceSettings(patch)
  }, [])

  const resetSettings = useCallback(() => resetVoiceSettings(), [])

  return {
    settings,
    updateSettings,
    resetSettings,
  }
}
