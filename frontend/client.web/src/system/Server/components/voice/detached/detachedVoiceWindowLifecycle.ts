import type { DetachedVoiceWorkspaceWindow } from './detachedVoiceWorkspaceTypes';

export function disposeAndCloseDetachedVoiceWorkspaceWindow(
  popup: DetachedVoiceWorkspaceWindow | null
) {
  if (!popup || popup.closed) {
    return;
  }

  popup.disposeVoiceWorkspaceRuntime?.();
  popup.close();
}
