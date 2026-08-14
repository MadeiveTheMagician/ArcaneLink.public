import type { UserResponse } from '../../../../shared/types'
import { commonCopy, settingsCopy } from '../../../shared/copy'
import { useAccountSessions } from './useAccountSessions'
import {
  ReadOnlyField,
  SettingsSection,
} from './SystemSettingsControls'
import styles from './SystemSettingsAccount.module.css'
import sharedStyles from './SystemSettingsControls.module.css'

type SystemSettingsAccountTabProps = {
  accessToken: string
  user: UserResponse
  currentDeviceSessionId?: string | null
  onLogout: () => void
  onRequestDelete: () => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function SystemSettingsAccountTab({
  accessToken,
  user,
  currentDeviceSessionId,
  onLogout,
  onRequestDelete,
}: SystemSettingsAccountTabProps) {
  const accountSessions = useAccountSessions({
    accessToken,
    currentDeviceSessionId,
  })

  return (
    <>
      <SettingsSection
        title={settingsCopy.account.accountInfoTitle}
        description={settingsCopy.account.accountInfoDescription}
      >
        <div className={sharedStyles.fieldList}>
          <ReadOnlyField label={settingsCopy.account.username} value={user.login} />
          <ReadOnlyField label={settingsCopy.account.email} value={user.email} />
        </div>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.account.passwordSecurityTitle}
        description={settingsCopy.account.passwordSecurityDescription}
      >
        <div className={sharedStyles.fieldList}>
          <ReadOnlyField label={settingsCopy.account.password} value="********" />
        </div>

        <div className={styles.disclosure}>
          <button
            className={styles.disclosureButton}
            type="button"
            aria-expanded={accountSessions.isOpen}
            onClick={accountSessions.toggle}
          >
            <span>{settingsCopy.account.activeSessions}</span>
            <em>
              {accountSessions.isOpen
                ? commonCopy.actions.collapse
                : commonCopy.actions.showAll}
            </em>
          </button>

          {accountSessions.isOpen && (
            <div className={styles.sessions}>
              {accountSessions.isLoading && (
                <p className={sharedStyles.statusText}>
                  {settingsCopy.account.loadingSessions}
                </p>
              )}
              {accountSessions.error && (
                <p className={sharedStyles.statusText}>{accountSessions.error}</p>
              )}
              {!accountSessions.isLoading &&
                !accountSessions.error &&
                accountSessions.sessions.length === 0 && (
                  <p className={sharedStyles.statusText}>
                    {settingsCopy.account.noSessions}
                  </p>
                )}
              {!accountSessions.isLoading &&
                !accountSessions.error &&
                accountSessions.sessions.map((session) => {
                  const isCurrent =
                    session.isCurrent || session.id === currentDeviceSessionId

                  return (
                    <article className={styles.sessionRow} key={session.id}>
                      <span>
                        <strong>
                          {session.deviceName ||
                            session.userAgent ||
                            settingsCopy.account.unknownDevice}
                        </strong>
                        <small>
                          {session.ipAddress || settingsCopy.account.ipUnknown} ·{' '}
                          {settingsCopy.account.lastActivity}{' '}
                          {formatDateTime(session.lastUsedAt)}
                        </small>
                      </span>
                      {isCurrent && (
                        <em>{settingsCopy.account.currentSession}</em>
                      )}
                    </article>
                  )
                })}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={settingsCopy.account.logout}>
        <button className={sharedStyles.dangerButton} type="button" onClick={onLogout}>
          {settingsCopy.account.logout}
        </button>
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.account.deleteAccount}
        description={settingsCopy.account.deleteAccountDescription}
      >
        <button
          className={sharedStyles.dangerButton}
          type="button"
          onClick={onRequestDelete}
        >
          {settingsCopy.account.deleteAccount}
        </button>
      </SettingsSection>
    </>
  )
}
