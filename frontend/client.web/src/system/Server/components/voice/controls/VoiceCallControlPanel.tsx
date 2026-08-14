import {
  SystemIcon,
  type SystemIconName,
  voiceCopy,
} from '../../../../shared/index'
import styles from './VoiceCallControlPanel.module.css'
import { resolveVoiceCallControlPresentation } from './voiceCallControlPresentation'

type VoiceCallControlPanelProps = {
  isMuted: boolean
  isDeafened: boolean
  isCameraEnabled: boolean
  isScreenSharing: boolean
  isSettingsOpen?: boolean
  className?: string
  onToggleMuted: () => void
  onToggleDeafened: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeaveVoiceChannel: () => void
  onOpenSettings?: () => void
}

export function VoiceCallControlPanel({
  isMuted,
  isDeafened,
  isCameraEnabled,
  isScreenSharing,
  isSettingsOpen = false,
  className,
  onToggleMuted,
  onToggleDeafened,
  onToggleCamera,
  onToggleScreenShare,
  onLeaveVoiceChannel,
  onOpenSettings,
}: VoiceCallControlPanelProps) {
  const controlState = {
    isMuted,
    isDeafened,
    isCameraEnabled,
    isScreenSharing,
  }
  const microphone = resolveVoiceCallControlPresentation(
    'isMuted',
    controlState,
  )
  const headphones = resolveVoiceCallControlPresentation(
    'isDeafened',
    controlState,
  )
  const camera = resolveVoiceCallControlPresentation(
    'isCameraEnabled',
    controlState,
  )
  const screenShare = resolveVoiceCallControlPresentation(
    'isScreenSharing',
    controlState,
  )

  return (
    <div className={`${styles.panel} ${className ?? ''}`}>
      <VoiceCallControlButton
        {...microphone}
        ariaPressed={microphone.active}
        onClick={onToggleMuted}
      />
      <VoiceCallControlButton
        {...headphones}
        ariaPressed={headphones.active}
        onClick={onToggleDeafened}
      />
      <VoiceCallControlButton
        {...camera}
        ariaPressed={camera.active}
        onClick={onToggleCamera}
      />
      <VoiceCallControlButton
        {...screenShare}
        ariaPressed={screenShare.active}
        onClick={onToggleScreenShare}
      />
      {onOpenSettings && (
        <VoiceCallControlButton
          label={voiceCopy.controls.settings}
          icon="settings"
          active={isSettingsOpen}
          ariaExpanded={isSettingsOpen}
          onClick={onOpenSettings}
        />
      )}
      <VoiceCallControlButton
        label={voiceCopy.controls.leave}
        icon="leave"
        danger
        onClick={onLeaveVoiceChannel}
      />
    </div>
  )
}

function VoiceCallControlButton({
  label,
  icon,
  active,
  tone = 'default',
  danger,
  ariaPressed,
  ariaExpanded,
  onClick,
}: {
  label: string
  icon: SystemIconName
  active?: boolean
  tone?: 'default' | 'danger'
  danger?: boolean
  ariaPressed?: boolean
  ariaExpanded?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`${styles.button} ${active ? styles.active : ''} ${
        danger ? styles.danger : ''
      }`}
      type="button"
      aria-label={label}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      title={label}
      onClick={onClick}
    >
      <SystemIcon
        className={styles.icon}
        name={icon}
        size={19}
        glow={active || danger || tone === 'danger'}
        tone={danger ? 'danger' : tone}
      />
    </button>
  )
}
