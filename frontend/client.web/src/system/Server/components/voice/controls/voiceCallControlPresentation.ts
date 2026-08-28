import { voiceCopy } from '../../../../shared/copy/voice.ru.ts';
import type { SystemIconName } from '../../../../shared/icons/SystemIcon.types';

export type VoiceCallControlName =
  'isMuted' | 'isDeafened' | 'isCameraEnabled' | 'isScreenSharing';

export type VoiceCallControlState = {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
};

export type VoiceCallControlPresentation = {
  label: string;
  icon: SystemIconName;
  active: boolean;
  tone: 'default' | 'danger';
};

export function resolveVoiceCallControlPresentation(
  controlName: VoiceCallControlName,
  state: VoiceCallControlState
): VoiceCallControlPresentation {
  switch (controlName) {
    case 'isMuted':
      return state.isMuted
        ? {
            label: voiceCopy.controls.micOn,
            icon: 'mic-off',
            active: false,
            tone: 'danger'
          }
        : {
            label: voiceCopy.controls.micOff,
            icon: 'mic-on',
            active: true,
            tone: 'default'
          };
    case 'isDeafened':
      return state.isDeafened
        ? {
            label: voiceCopy.controls.deafenedOff,
            icon: 'headphones-off',
            active: false,
            tone: 'danger'
          }
        : {
            label: voiceCopy.controls.deafenedOn,
            icon: 'headphones-on',
            active: true,
            tone: 'default'
          };
    case 'isCameraEnabled':
      return state.isCameraEnabled
        ? {
            label: voiceCopy.controls.cameraOff,
            icon: 'camera',
            active: true,
            tone: 'default'
          }
        : {
            label: voiceCopy.controls.cameraOn,
            icon: 'camera-off',
            active: false,
            tone: 'danger'
          };
    case 'isScreenSharing':
      return state.isScreenSharing
        ? {
            label: voiceCopy.controls.screenOff,
            icon: 'screen',
            active: true,
            tone: 'default'
          }
        : {
            label: voiceCopy.controls.screenOn,
            icon: 'screen-off',
            active: false,
            tone: 'danger'
          };
  }
}
