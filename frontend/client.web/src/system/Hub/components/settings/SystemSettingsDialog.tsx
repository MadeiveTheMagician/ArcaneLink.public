import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  defaultStreamingSettings,
  loadStreamingSettings,
  saveStreamingSettings,
} from '../../../../shared/streaming/streamingSettings'
import type { StreamingSettings } from '../../../../shared/streaming/streamingSettings'
import type { ServerMemberResponse, UserResponse } from '../../../../shared/types'
import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes'
import type { VoiceNoiseSuppressionTelemetry } from '../../../Server/hooks/voice/useVoiceChannel'
import {
  loadAttachmentSecuritySettings,
  saveAttachmentSecuritySettings,
  type AttachmentSecuritySettings,
} from '../../../../shared/security/attachmentSecuritySettings'
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings'
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon'
import {
  commonCopy,
  notificationCopy,
  settingsCopy,
} from '../../../shared/copy'
import dialogStyles from '../../../shared/styles/Dialog.module.css'
import { SystemSettingsAccountTab } from './SystemSettingsAccountTab'
import { SystemSettingsInterfaceTab } from './SystemSettingsInterfaceTab'
import { SystemSettingsNotificationsTab } from './SystemSettingsNotificationsTab'
import { SystemSettingsPrivacyTab } from './SystemSettingsPrivacyTab'
import {
  StreamingSettingsTab,
  VoiceSettingsTab,
} from './SystemSettingsMediaTabs'
import { SystemSettingsProfileTab } from './SystemSettingsProfileTab'
import { SystemSettingsSecurityTab } from './SystemSettingsSecurityTab'
import styles from './SystemSettingsDialog.module.css'
import sharedStyles from './SystemSettingsControls.module.css'
import { MyModerationReportsTab } from '../../../Moderation/components/MyModerationReportsTab'
import { moderationCopy } from '../../../Moderation/moderationCopy.ru'
import { useAnimatedOverlayClose } from '../../../shared/hooks/useAnimatedOverlayClose'
import { useDismissableLayer } from '../../../shared/hooks/useDismissableLayer'
import {
  resolveSystemSettingsInitialTab,
  type SystemSettingsNavigationRequest,
  type SystemSettingsTabId,
} from '../../../shared/navigation/systemSettingsNavigation'
import { systemSettingsCloseDurationMs } from '../../../shared/overlays/animatedOverlayPhaseModel'
import { isVoiceSpatialAudioAvailable } from '../../../shared/voice/voiceSettings'

type SystemSettingsDialogProps = {
  accessToken: string
  user: UserResponse
  serverMemberships: ServerMemberResponse[]
  currentDeviceSessionId?: string | null
  settingsDraft: ProfileSettingsDraft
  navigationRequest?: SystemSettingsNavigationRequest | null
  voiceDiagnostics?: VoiceConnectionDiagnostics | null
  voiceNoiseSuppressionTelemetry?: VoiceNoiseSuppressionTelemetry | null
  defaultSettings: ProfileSettingsDraft
  isSaving: boolean
  onChange: (settings: ProfileSettingsDraft) => void
  onCommit: (settings: ProfileSettingsDraft) => Promise<void> | void
  onProfileIdentityChanged: () => Promise<void> | void
  onClose: () => void
  onLogout: () => void
}

const settingsTabs: {
  id: SystemSettingsTabId
  label: string
  sections: string[]
}[] = [
  {
    id: 'account',
    label: settingsCopy.tabs.account,
    sections: [
      settingsCopy.account.accountInfoTitle,
      settingsCopy.account.passwordSecurityTitle,
      settingsCopy.account.logout,
      settingsCopy.account.deleteAccount,
    ],
  },
  {
    id: 'profile',
    label: settingsCopy.tabs.profile,
    sections: [
      settingsCopy.profile.identityTitle,
      settingsCopy.profile.profileTagsTitle,
      settingsCopy.profile.bannerTitle,
      settingsCopy.profile.backgroundTitle,
      settingsCopy.profile.serverProfilesTitle,
    ],
  },
  {
    id: 'interface',
    label: settingsCopy.tabs.interface,
    sections: [
      settingsCopy.interface.themeTitle,
      settingsCopy.interface.interfaceScaleTitle,
      settingsCopy.interface.messagesTitle,
      settingsCopy.interface.advancedFeatures,
    ],
  },
  {
    id: 'privacy',
    label: settingsCopy.tabs.privacy,
    sections: [
      settingsCopy.privacy.directMessagesTitle,
      settingsCopy.privacy.visibilityTitle,
      settingsCopy.privacy.modeTitle,
    ],
  },
  {
    id: 'notifications',
    label: notificationCopy.title,
    sections: [
      notificationCopy.title,
      notificationCopy.settings.eventsTitle,
      notificationCopy.settings.additionalTitle,
    ],
  },
  {
    id: 'reports',
    label: moderationCopy.myReports.tab,
    sections: [moderationCopy.myReports.tab],
  },
  {
    id: 'security',
    label: settingsCopy.tabs.security,
    sections: [settingsCopy.security.systemWarningsTitle],
  },
  {
    id: 'streaming',
    label: settingsCopy.tabs.streaming,
    sections: [settingsCopy.streaming.qualityTitle],
  },
  {
    id: 'voice',
    label: settingsCopy.tabs.voice,
    sections: [
      settingsCopy.voice.profileTitle,
      settingsCopy.voice.deviceTitle,
      settingsCopy.voice.inputProcessingTitle,
      settingsCopy.voice.spatialAudioTitle,
      settingsCopy.voice.qualityTitle,
      settingsCopy.voice.connectionBehaviorTitle,
      settingsCopy.voice.connectionDiagnosticsTitle,
      settingsCopy.voice.warningTitle,
    ],
  },
]

export function SystemSettingsDialog({
  accessToken,
  user,
  serverMemberships,
  currentDeviceSessionId,
  settingsDraft,
  navigationRequest = null,
  voiceDiagnostics = null,
  voiceNoiseSuppressionTelemetry = null,
  defaultSettings,
  isSaving,
  onChange,
  onCommit,
  onProfileIdentityChanged,
  onClose,
  onLogout,
}: SystemSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SystemSettingsTabId>(
    () => resolveSystemSettingsInitialTab(navigationRequest),
  )
  const [expandedTab, setExpandedTab] = useState<SystemSettingsTabId | null>(
    () => resolveSystemSettingsInitialTab(navigationRequest),
  )
  const [activeSection, setActiveSection] = useState<{
    tabId: SystemSettingsTabId
    label: string
  } | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const settingsDialogRef = useRef<HTMLElement | null>(null)
  const settingsContentRef = useRef<HTMLDivElement | null>(null)
  const [streamingSettings, setStreamingSettings] =
    useState<StreamingSettings>(() => loadStreamingSettings())
  const [securitySettings, setSecuritySettings] =
    useState<AttachmentSecuritySettings>(() => loadAttachmentSecuritySettings())
  const { isClosing, requestClose } = useAnimatedOverlayClose(
    systemSettingsCloseDurationMs,
  )
  const closeSettings = useCallback(() => {
    requestClose(onClose)
  }, [onClose, requestClose])

  useDismissableLayer({
    isOpen: !isDeleteConfirmOpen && !isClosing,
    layerRef: settingsDialogRef,
    onDismiss: closeSettings,
  })

  useEffect(() => {
    if (
      !navigationRequest?.targetId ||
      activeTab !== navigationRequest.tab
    ) {
      return undefined
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(navigationRequest.targetId!)
      if (!target || !settingsDialogRef.current?.contains(target)) return

      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const focusTarget = target.querySelector<HTMLElement>(
        'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      focusTarget?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(focusFrame)
  }, [activeTab, navigationRequest])

  useEffect(() => {
    if (!activeSection || activeSection.tabId !== activeTab) {
      return undefined
    }

    const navigationFrame = window.requestAnimationFrame(() => {
      const content = settingsContentRef.current
      if (!content) return

      const target = [...content.querySelectorAll<HTMLElement>('section')]
        .find((section) =>
          section.querySelector('h3')?.textContent?.trim() ===
          activeSection.label,
        )
      if (!target) {
        content.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      const sectionToggle = target.querySelector<HTMLButtonElement>(
        '[data-settings-section-toggle]',
      )
      if (sectionToggle?.getAttribute('aria-expanded') === 'false') {
        sectionToggle.click()
      }

      target.scrollIntoView({ block: 'start', behavior: 'smooth' })
      target
        .querySelector<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(navigationFrame)
  }, [activeSection, activeTab])

  function toggleSettingsCategory(tabId: SystemSettingsTabId) {
    setActiveTab(tabId)
    setActiveSection(null)
    setExpandedTab((current) => (current === tabId ? null : tabId))
  }

  function openSettingsSection(
    tabId: SystemSettingsTabId,
    label: string,
  ) {
    setActiveTab(tabId)
    setExpandedTab(tabId)
    setActiveSection({ tabId, label })
  }

  function updateStreamingSettings(patch: Partial<StreamingSettings>) {
    const nextSettings = {
      ...streamingSettings,
      ...patch,
    }

    setStreamingSettings(nextSettings)
    saveStreamingSettings(nextSettings)
  }

  function resetStreamingSettings() {
    setStreamingSettings(defaultStreamingSettings)
    saveStreamingSettings(defaultStreamingSettings)
  }

  function updateSecuritySettings(settings: AttachmentSecuritySettings) {
    setSecuritySettings(settings)
    saveAttachmentSecuritySettings(settings)
  }

  return (
    <div
      className={`${dialogStyles.backdrop} ${styles.backdrop} ${
        isClosing ? styles.backdropClosing : ''
      }`}
      role="presentation"
      style={
        {
          '--settings-close-duration': `${systemSettingsCloseDurationMs}ms`,
        } as CSSProperties
      }
    >
      <section
        ref={settingsDialogRef}
        aria-labelledby="profile-settings-title"
        aria-modal="true"
        className={`${dialogStyles.dialog} ${styles.dialog} ${
          isClosing ? styles.dialogClosing : ''
        }`}
        role="dialog"
      >
        <header className={styles.header}>
          <span>{settingsCopy.root.eyebrow}</span>
          <h2 id="profile-settings-title">{settingsCopy.root.title}</h2>
          <p>{settingsCopy.root.description}</p>
          <button
            className={styles.closeButton}
            type="button"
            aria-label={settingsCopy.root.close}
            disabled={isClosing}
            onClick={closeSettings}
          >
            <SystemCloseIcon size="large" />
          </button>
          {isSaving && (
            <em className={styles.savingState}>{settingsCopy.root.saving}</em>
          )}
        </header>

        <div className={styles.shell}>
          <nav className={styles.tabs} aria-label={settingsCopy.root.tabs}>
            {settingsTabs.map((tab) => {
              const isExpanded = expandedTab === tab.id

              return (
                <div className={styles.tabGroup} key={tab.id}>
                  <button
                    className={`${styles.tab} ${
                      activeTab === tab.id ? styles.activeTab : ''
                    }`}
                    type="button"
                    aria-expanded={isExpanded}
                    data-tooltip={isExpanded ? undefined : tab.label}
                    onClick={() => toggleSettingsCategory(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`${styles.tabChevron} ${
                        isExpanded ? styles.tabChevronExpanded : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isExpanded && (
                    <ol
                      className={styles.sectionList}
                      aria-label={`${tab.label}: разделы`}
                    >
                      {tab.sections.map((sectionLabel) => {
                        const isDisabled =
                          tab.id === 'voice' &&
                          sectionLabel ===
                            settingsCopy.voice.spatialAudioTitle &&
                          !isVoiceSpatialAudioAvailable
                        const isCurrent =
                          activeSection?.tabId === tab.id &&
                          activeSection.label === sectionLabel

                        return (
                          <li key={sectionLabel}>
                            <button
                              className={`${styles.sectionLink} ${
                                isCurrent
                                  ? styles.activeSectionLink
                                  : ''
                              }`}
                              type="button"
                              disabled={isDisabled}
                              aria-current={
                                isCurrent ? 'location' : undefined
                              }
                              onClick={() =>
                                openSettingsSection(
                                  tab.id,
                                  sectionLabel,
                                )
                              }
                            >
                              {sectionLabel}
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )
            })}
          </nav>

          <div ref={settingsContentRef} className={styles.content}>
            {activeTab === 'account' && (
              <SystemSettingsAccountTab
                accessToken={accessToken}
                user={user}
                currentDeviceSessionId={currentDeviceSessionId}
                onLogout={onLogout}
                onRequestDelete={() => setIsDeleteConfirmOpen(true)}
              />
            )}
            {activeTab === 'profile' && (
              <SystemSettingsProfileTab
                accessToken={accessToken}
                user={user}
                serverMemberships={serverMemberships}
                settings={settingsDraft}
                onProfileIdentityChanged={onProfileIdentityChanged}
                onChange={onChange}
                onCommit={onCommit}
              />
            )}
            {activeTab === 'interface' && (
              <SystemSettingsInterfaceTab
                settings={settingsDraft}
                defaultSettings={defaultSettings}
                onChange={onChange}
                onCommit={onCommit}
              />
            )}
            {activeTab === 'privacy' && (
              <SystemSettingsPrivacyTab
                settings={settingsDraft}
                isSaving={isSaving}
                onChange={onChange}
                onCommit={onCommit}
              />
            )}
            {activeTab === 'security' && (
              <SystemSettingsSecurityTab
                settings={securitySettings}
                onChange={updateSecuritySettings}
              />
            )}
            {activeTab === 'notifications' && (
              <SystemSettingsNotificationsTab currentUserId={user.id} />
            )}
            {activeTab === 'reports' && (
              <MyModerationReportsTab accessToken={accessToken} />
            )}
            {activeTab === 'streaming' && (
              <StreamingSettingsTab
                settings={streamingSettings}
                user={user}
                onChange={updateStreamingSettings}
                onReset={resetStreamingSettings}
              />
            )}
            {activeTab === 'voice' && (
              <VoiceSettingsTab
                diagnostics={voiceDiagnostics}
                noiseSuppressionTelemetry={voiceNoiseSuppressionTelemetry}
              />
            )}
          </div>
        </div>
      </section>

      {isDeleteConfirmOpen && (
        <div className={styles.confirmBackdrop} role="presentation">
          <section
            className={styles.confirmDialog}
            role="alertdialog"
            aria-labelledby="delete-account-title"
          >
            <h3 id="delete-account-title">
              {settingsCopy.account.deleteAccountQuestion}
            </h3>
            <p>{settingsCopy.account.deleteAccountWarning}</p>
            <div className={styles.confirmActions}>
              <button
                className={sharedStyles.secondaryAction}
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                {commonCopy.actions.cancel}
              </button>
              <button className={sharedStyles.dangerButton} type="button" disabled>
                {settingsCopy.account.yesDelete}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
