import type { AttachmentSecuritySettings } from '../../../../shared/security/attachmentSecuritySettings'
import { settingsCopy } from '../../../shared/copy'
import { dangerousFilesWarningSettingsTargetId } from '../../../shared/navigation/systemSettingsNavigation'
import { SettingsSection, ToggleField } from './SystemSettingsControls'

export function SystemSettingsSecurityTab({
  settings,
  onChange,
}: {
  settings: AttachmentSecuritySettings
  onChange: (settings: AttachmentSecuritySettings) => void
}) {
  return (
    <SettingsSection
      title={settingsCopy.security.systemWarningsTitle}
      description={settingsCopy.security.systemWarningsDescription}
    >
      <ToggleField
        id={dangerousFilesWarningSettingsTargetId}
        label={settingsCopy.security.dangerousFilesWarning}
        description={settingsCopy.security.dangerousFilesWarningDescription}
        checked={settings.warnAboutPotentiallyDangerousFiles}
        onChange={(checked) =>
          onChange({ warnAboutPotentiallyDangerousFiles: checked })
        }
      />
    </SettingsSection>
  )
}
