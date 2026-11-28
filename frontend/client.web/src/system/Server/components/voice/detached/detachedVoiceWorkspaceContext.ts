import { createContext } from 'react'

export const DetachedVoiceWorkspaceContext = createContext<
  ((workspaceKey: string, isOpen: boolean) => void) | null
>(null)
