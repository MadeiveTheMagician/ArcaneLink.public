import {
  type DetachedControlIconName,
  getDetachedControlIconCss
} from './detachedVoiceIcons';
import type { DetachedVoiceWorkspaceControlState } from './detachedVoiceWorkspaceTypes';

export function createDetachedControlButton(
  document: Document,
  {
    label,
    icon,
    active,
    danger,
    controlName,
    onClick
  }: {
    label: string;
    icon: DetachedControlIconName;
    active?: boolean;
    danger?: boolean;
    controlName?: keyof DetachedVoiceWorkspaceControlState;
    onClick: (event: MouseEvent) => void;
  }
) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'arcane-detached-control-button';
  button.setAttribute('aria-label', label);
  button.dataset.active = active ? 'true' : 'false';
  button.dataset.danger = danger ? 'true' : 'false';
  if (controlName) {
    button.dataset.detachedControl = controlName;
    button.dataset.detachedIcon = icon;
  }
  const glyph = document.createElement('span');
  glyph.className = 'arcane-detached-control-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.dataset.detachedControlGlyph = 'true';
  glyph.style.background = getDetachedControlIconCss(icon, Boolean(active));
  button.append(glyph);
  button.addEventListener('click', onClick);

  return button;
}

export function updateDetachedControlButtons(
  document: Document,
  controlState: DetachedVoiceWorkspaceControlState,
  labels: Record<keyof DetachedVoiceWorkspaceControlState, string>
) {
  const activeByControl: Record<
    keyof DetachedVoiceWorkspaceControlState,
    boolean
  > = {
    isMuted: !controlState.isMuted,
    isDeafened: !controlState.isDeafened,
    isCameraEnabled: controlState.isCameraEnabled,
    isScreenSharing: controlState.isScreenSharing
  };

  document
    .querySelectorAll<HTMLButtonElement>('[data-detached-control]')
    .forEach((button) => {
      const controlName = button.dataset.detachedControl as
        keyof DetachedVoiceWorkspaceControlState | undefined;
      const icon = button.dataset.detachedIcon as
        DetachedControlIconName | undefined;

      if (!controlName || !icon) {
        return;
      }

      const active = activeByControl[controlName];
      button.setAttribute('aria-label', labels[controlName]);
      button.dataset.active = active ? 'true' : 'false';

      const glyph = button.querySelector<HTMLElement>(
        '[data-detached-control-glyph="true"]'
      );
      if (glyph) {
        glyph.style.background = getDetachedControlIconCss(icon, active);
      }
    });
}
