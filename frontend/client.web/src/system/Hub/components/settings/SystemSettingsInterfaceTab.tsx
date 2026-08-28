import type { CSSProperties } from 'react'
import {
  getProfileColor,
  getSystemTheme,
  getThemeDominantTextColor,
  SYSTEM_THEMES,
} from '../../../../styles/systemThemes'
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings'
import { settingsCopy } from '../../../shared/copy'
import { SystemIcon } from '../../../shared/icons/SystemIcon'
import {
  ScaleControl,
  SettingsSection,
  ToggleField,
} from './SystemSettingsControls'
import styles from './SystemSettingsInterface.module.css'
import sharedStyles from './SystemSettingsControls.module.css'
import { MessagePresentationSettingsField } from './MessagePresentationSettingsField'

type SystemSettingsInterfaceTabProps = {
  settings: ProfileSettingsDraft
  defaultSettings: ProfileSettingsDraft
  onChange: (settings: ProfileSettingsDraft) => void
  onCommit: (settings: ProfileSettingsDraft) => Promise<void> | void
}

export function SystemSettingsInterfaceTab({
  settings,
  defaultSettings,
  onChange,
  onCommit,
}: SystemSettingsInterfaceTabProps) {
  const previewStyle = {
    '--profile-preview-scale': settings.interfaceScale,
    '--profile-preview-font-scale': settings.fontScale,
  } as CSSProperties

  function createSettings(patch: Partial<ProfileSettingsDraft>) {
    return { ...settings, ...patch }
  }

  function updateSettings(patch: Partial<ProfileSettingsDraft>) {
    onChange(createSettings(patch))
  }

  function commitSettings(patch: Partial<ProfileSettingsDraft>) {
    const nextSettings = createSettings(patch)
    onChange(nextSettings)
    void onCommit(nextSettings)
  }

  function resetInterfaceSettings() {
    onChange(defaultSettings)
    void onCommit(defaultSettings)
  }

  return (
    <>
      <SettingsSection
        title={settingsCopy.interface.themeTitle}
        description={settingsCopy.interface.themeDescription}
      >
        <div className={styles.themeGrid}>
          {SYSTEM_THEMES.map((theme) => {
            const isActive = settings.selectedThemeCode === theme.code

            return (
              <button
                className={`${styles.themeTile} ${
                  isActive ? styles.activeThemeTile : ''
                }`}
                key={theme.code}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  commitSettings({
                    selectedThemeCode: theme.code,
                    profileColor: null,
                  })
                }
                style={
                  {
                    '--theme-tile-dominant': theme.dominantColor,
                    '--theme-tile-contrast': getThemeDominantTextColor(
                      theme.dominantColor,
                    ),
                    '--theme-icon-gradient-start': theme.previewColors[2],
                    '--theme-icon-gradient-middle': theme.previewColors[1],
                    '--theme-accent-light': theme.previewColors[2],
                    '--theme-icon-gradient-end': theme.dominantColor,
                    '--theme-icon-outline': getThemeDominantTextColor(
                      theme.dominantColor,
                    ),
                    '--theme-icon-glow-color': theme.dominantColor,
                  } as CSSProperties
                }
              >
                <SystemIcon
                  className={styles.themeIcon}
                  name="settings"
                  size={26}
                />
                <span className={styles.themeSwatches} aria-hidden="true">
                  {theme.previewColors.map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </span>
                <strong>{theme.title}</strong>
              </button>
            )
          })}
        </div>

        <div className={styles.profileColorPanel}>
          <span
            className={styles.profileColorPreview}
            style={{
              background: getProfileColor(
                settings.selectedThemeCode,
                settings.profileColor,
              ),
            }}
            aria-hidden="true"
          />
          <span>
            <strong>{settingsCopy.interface.profileColor}</strong>
            <small>
              {settingsCopy.interface.profileInheritsTheme}{' '}
              {getSystemTheme(settings.selectedThemeCode).title}.
            </small>
          </span>
        </div>

        <ToggleField
          label={settingsCopy.interface.applyThemeToOtherProfiles}
          description={
            settingsCopy.interface.applyThemeToOtherProfilesDescription
          }
          checked={settings.applySystemThemeToOtherProfiles}
          onChange={(applySystemThemeToOtherProfiles) =>
            commitSettings({ applySystemThemeToOtherProfiles })
          }
        />
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.interface.interfaceScaleTitle}
        description={settingsCopy.interface.interfaceScaleDescription}
      >
        <div className={styles.scaleGrid}>
          <ScaleControl
            label={settingsCopy.interface.profileInterface}
            min={0.85}
            max={1.2}
            step={0.01}
            value={settings.interfaceScale}
            onChange={(interfaceScale) => updateSettings({ interfaceScale })}
            onCommit={(interfaceScale) => commitSettings({ interfaceScale })}
          />
          <ScaleControl
            label={settingsCopy.interface.fontScale}
            min={0.9}
            max={1.2}
            step={0.01}
            value={settings.fontScale}
            onChange={(fontScale) => updateSettings({ fontScale })}
            onCommit={(fontScale) => commitSettings({ fontScale })}
          />
          <ScaleControl
            label={settingsCopy.interface.serverInterface}
            min={0.85}
            max={1.2}
            step={0.01}
            value={settings.serverInterfaceScale}
            onChange={(serverInterfaceScale) =>
              updateSettings({ serverInterfaceScale })
            }
            onCommit={(serverInterfaceScale) =>
              commitSettings({ serverInterfaceScale })
            }
          />
        </div>
        <div className={sharedStyles.preview} style={previewStyle}>
          <strong>Arcane Link</strong>
          <span>{settingsCopy.interface.scalePreview}</span>
        </div>
        <button
          className={sharedStyles.secondaryAction}
          type="button"
          onClick={resetInterfaceSettings}
        >
          {settingsCopy.actions.resetScale}
        </button>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.interface.messagesTitle}
        description={settingsCopy.interface.messagesDescription}
      >
        <div className={styles.messageFormatPanel}>
          <span className={styles.messageFormatHeader}>
            <strong>{settingsCopy.interface.messageDisplayFormatTitle}</strong>
            <small>
              {settingsCopy.interface.messageDisplayFormatDescription}
            </small>
          </span>
          <div className={styles.messageFormatGrid}>
            <MessagePresentationSettingsField
              title={settingsCopy.interface.messageDisplayFormatServers}
              description={
                settingsCopy.interface.messageDisplayFormatServersDescription
              }
              format={settings.serverMessageDisplayFormat}
              bubbleAlignment={settings.serverMessageBubbleAlignment}
              bubbleWidth={settings.serverMessageBubbleWidth}
              onFormatChange={(serverMessageDisplayFormat) =>
                commitSettings({ serverMessageDisplayFormat })
              }
              onBubbleAlignmentChange={(serverMessageBubbleAlignment) =>
                commitSettings({ serverMessageBubbleAlignment })
              }
              onBubbleWidthChange={(serverMessageBubbleWidth) =>
                commitSettings({ serverMessageBubbleWidth })
              }
            />
            <MessagePresentationSettingsField
              title={settingsCopy.interface.messageDisplayFormatPrivate}
              description={
                settingsCopy.interface.messageDisplayFormatPrivateDescription
              }
              format={settings.privateMessageDisplayFormat}
              bubbleAlignment={settings.privateMessageBubbleAlignment}
              bubbleWidth={settings.privateMessageBubbleWidth}
              onFormatChange={(privateMessageDisplayFormat) =>
                commitSettings({ privateMessageDisplayFormat })
              }
              onBubbleAlignmentChange={(privateMessageBubbleAlignment) =>
                commitSettings({ privateMessageBubbleAlignment })
              }
              onBubbleWidthChange={(privateMessageBubbleWidth) =>
                commitSettings({ privateMessageBubbleWidth })
              }
            />
          </div>
        </div>
        <ToggleField
          label={settingsCopy.interface.expandMessageAttachmentsByDefault}
          description={
            settingsCopy.interface.expandMessageAttachmentsByDefaultDescription
          }
          checked={settings.expandMessageAttachmentsByDefault}
          onChange={(expandMessageAttachmentsByDefault) =>
            commitSettings({ expandMessageAttachmentsByDefault })
          }
        />
        <ToggleField
          label={settingsCopy.interface.loadExternalMediaPreviews}
          description={settingsCopy.interface.loadExternalMediaPreviewsDescription}
          checked={settings.loadExternalMediaPreviews}
          onChange={(loadExternalMediaPreviews) =>
            commitSettings({ loadExternalMediaPreviews })
          }
        />
        {settings.loadExternalMediaPreviews ? (
          <div className={styles.videoCardSizes}>
            <strong>{settingsCopy.interface.videoCardSizeTitle}</strong>
            <div className={styles.scaleGrid}>
              <ScaleControl
                label={settingsCopy.interface.horizontalVideoCards}
                min={1}
                max={6}
                step={1}
                value={settings.horizontalVideoCardSize}
                formatValue={String}
                onChange={(horizontalVideoCardSize) =>
                  updateSettings({ horizontalVideoCardSize })
                }
                onCommit={(horizontalVideoCardSize) =>
                  commitSettings({ horizontalVideoCardSize })
                }
              />
              <ScaleControl
                label={settingsCopy.interface.verticalVideoCards}
                min={1}
                max={6}
                step={1}
                value={settings.verticalVideoCardSize}
                formatValue={String}
                onChange={(verticalVideoCardSize) =>
                  updateSettings({ verticalVideoCardSize })
                }
                onCommit={(verticalVideoCardSize) =>
                  commitSettings({ verticalVideoCardSize })
                }
              />
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title={settingsCopy.interface.advancedFeatures}>
        <ToggleField
          label={settingsCopy.interface.toggleServerRailPinned}
          description={settingsCopy.interface.toggleServerRailPinnedDescription}
          checked={settings.isServerRailPinned}
          onChange={(isServerRailPinned) =>
            commitSettings({ isServerRailPinned })
          }
        />
        <ToggleField
          label={settingsCopy.interface.showPrivateReadAllButton}
          description={settingsCopy.interface.showPrivateReadAllButtonDescription}
          checked={settings.showPrivateReadAllButton}
          onChange={(showPrivateReadAllButton) =>
            commitSettings({ showPrivateReadAllButton })
          }
        />
      </SettingsSection>

      <button
        className={sharedStyles.secondaryAction}
        type="button"
        onClick={resetInterfaceSettings}
      >
        {settingsCopy.actions.resetInterface}
      </button>
    </>
  )
}
