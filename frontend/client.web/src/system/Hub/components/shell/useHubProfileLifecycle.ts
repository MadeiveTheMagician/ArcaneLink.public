import { useEffect } from 'react'
import { applySystemThemeToDocument } from '../../../../styles/systemThemes'

type UseHubProfileLifecycleOptions = {
  isServerRailPinned: boolean
  selectedThemeCode: string
  setServerPanelOpen: (isOpen: boolean) => void
}

export function useHubProfileLifecycle({
  isServerRailPinned,
  selectedThemeCode,
  setServerPanelOpen,
}: UseHubProfileLifecycleOptions) {
  useEffect(() => {
    if (isServerRailPinned) {
      setServerPanelOpen(true)
    }
  }, [isServerRailPinned, setServerPanelOpen])

  useEffect(() => {
    applySystemThemeToDocument(selectedThemeCode)
  }, [selectedThemeCode])
}
