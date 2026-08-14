import { useCallback, useSyncExternalStore } from 'react'
import {
  activateVoiceProfile,
  createVoiceProfile,
  deleteVoiceProfile,
  duplicateVoiceProfile,
  getVoiceProfilesSnapshot,
  renameVoiceProfile,
  resetActiveVoiceProfile,
  subscribeVoiceProfiles,
  type VoiceProfilesSnapshot,
} from './voiceProfiles'

const serverSnapshot: VoiceProfilesSnapshot = {
  activeProfileId: 'default',
  profiles: [],
}
const getServerSnapshot = () => serverSnapshot
const subscribeToVoiceProfiles = (onStoreChange: () => void) =>
  subscribeVoiceProfiles(onStoreChange)

export function useVoiceProfiles() {
  const snapshot = useSyncExternalStore(
    subscribeToVoiceProfiles,
    getVoiceProfilesSnapshot,
    getServerSnapshot,
  )

  const activate = useCallback((profileId: string) => {
    return activateVoiceProfile(profileId)
  }, [])
  const create = useCallback((name: string) => {
    return createVoiceProfile(name)
  }, [])
  const duplicate = useCallback((profileId: string) => {
    return duplicateVoiceProfile(profileId)
  }, [])
  const rename = useCallback((profileId: string, name: string) => {
    return renameVoiceProfile(profileId, name)
  }, [])
  const remove = useCallback((profileId: string) => {
    return deleteVoiceProfile(profileId)
  }, [])
  const resetActive = useCallback(() => resetActiveVoiceProfile(), [])

  return {
    ...snapshot,
    activate,
    create,
    duplicate,
    rename,
    remove,
    resetActive,
  }
}
