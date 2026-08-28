import { SettingsSection, ToggleField } from './SystemSettingsControls'
import { useNotificationPreferences } from '../notifications/notificationPreferences'
import { notificationCopy } from '../../../shared/copy'
import { SystemSelect } from '../../../shared/ui/SystemSelect'
import styles from './SystemSettingsNotificationsTab.module.css'

const notificationToggles = [
  'privateMessages',
  'mentions',
  'serverInvites',
  'privateSpaceInvites',
  'system',
] as const

type SystemSettingsNotificationsTabProps = {
  currentUserId: string
}

export function SystemSettingsNotificationsTab({
  currentUserId,
}: SystemSettingsNotificationsTabProps) {
  const { preferences, updatePreferences } =
    useNotificationPreferences(currentUserId)

  return (
    <>
      <SettingsSection title={notificationCopy.title}>
        <ToggleField
          label={notificationCopy.quickSettings.all}
          description={notificationCopy.settings.masterDescription}
          checked={preferences.enabled}
          onChange={(enabled) => updatePreferences({ enabled })}
        />
      </SettingsSection>

      <SettingsSection
        title={notificationCopy.settings.eventsTitle}
        description={notificationCopy.settings.eventsDescription}
      >
        <div className={styles.list}>
          {notificationToggles.map((key) => {
            const copy = notificationCopy.settings.toggles[key]
            return (
              <ToggleField
                key={key}
                label={copy.label}
                description={copy.description}
                checked={preferences[key]}
                onChange={(checked) => updatePreferences({ [key]: checked })}
              />
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={notificationCopy.settings.additionalTitle}>
        <div className={styles.selectRow}>
          <label>
            <span>{notificationCopy.settings.placementLabel}</span>
            <SystemSelect
              aria-label={notificationCopy.settings.placementLabel}
              value={preferences.placement}
              onValueChange={(value) =>
                updatePreferences({
                  placement: value as typeof preferences.placement,
                })
              }
            >
              <option value="bottom-right">
                {notificationCopy.settings.placementBottomRight}
              </option>
              <option value="bottom-left">
                {notificationCopy.settings.placementBottomLeft}
              </option>
            </SystemSelect>
          </label>
        </div>
      </SettingsSection>
    </>
  )
}
