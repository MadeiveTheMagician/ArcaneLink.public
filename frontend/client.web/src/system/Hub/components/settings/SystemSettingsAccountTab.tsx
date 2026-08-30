import { useId } from 'react';

import type { UserResponse } from '../../../../shared/types';
import { commonCopy, settingsCopy } from '../../../shared/copy';
import { AccountCredentialEditors } from './AccountCredentialEditors';
import { SettingsSection } from './SystemSettingsControls';
import { useAccountSessions } from './useAccountSessions';

import styles from './SystemSettingsAccount.module.css';
import sharedStyles from './SystemSettingsControls.module.css';

type SystemSettingsAccountTabProps = {
  accessToken: string;
  user: UserResponse;
  currentDeviceSessionId?: string | null;
  onLogout: () => void;
  onRequestDelete: () => void;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function SystemSettingsAccountTab({
  accessToken,
  user,
  currentDeviceSessionId,
  onLogout,
  onRequestDelete
}: SystemSettingsAccountTabProps) {
  const accountSessions = useAccountSessions({
    accessToken,
    currentDeviceSessionId
  });
  const sessionsId = useId();

  return (
    <>
      <SettingsSection
        title={settingsCopy.account.accountInfoTitle}
        description={settingsCopy.account.accountInfoDescription}
      >
        <AccountCredentialEditors
          accessToken={accessToken}
          user={user}
          editors={['login', 'email']}
          onReauthenticationRequired={(message) => {
            window.alert(message);
            onLogout();
          }}
        />
      </SettingsSection>

      <SettingsSection
        title={settingsCopy.account.passwordSecurityTitle}
        description={settingsCopy.account.passwordSecurityDescription}
      >
        <AccountCredentialEditors
          accessToken={accessToken}
          user={user}
          editors={['password']}
          onReauthenticationRequired={(message) => {
            window.alert(message);
            onLogout();
          }}
        />

        <div className={styles.disclosure}>
          <button
            className={styles.disclosureButton}
            type="button"
            data-account-sessions-toggle
            aria-controls={sessionsId}
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

          <div
            className={`${styles.sessionsDisclosure} ${
              accountSessions.isOpen ? styles.sessionsDisclosureExpanded : ''
            }`}
            id={sessionsId}
            data-account-sessions-content
            aria-hidden={!accountSessions.isOpen}
            inert={!accountSessions.isOpen ? true : undefined}
          >
            <div className={styles.sessionsDisclosureClip}>
              <div className={styles.sessions}>
                {!accountSessions.isLoading && !accountSessions.error && (
                  <div className={styles.sessionsToolbar}>
                    <span>
                      {accountSessions.otherSessionCount > 0
                        ? settingsCopy.account.otherSessionsCount(
                            accountSessions.otherSessionCount
                          )
                        : settingsCopy.account.currentSessionProtected}
                    </span>
                    <div className={styles.sessionsToolbarActions}>
                      <button
                        className={styles.revokeAllButton}
                        type="button"
                        disabled={
                          accountSessions.otherSessionCount === 0 ||
                          !currentDeviceSessionId ||
                          accountSessions.isRevokingOthers ||
                          accountSessions.isRevokingAll ||
                          Boolean(accountSessions.revokingSessionId)
                        }
                        onClick={() => {
                          const isConfirmed = window.confirm(
                            `${settingsCopy.account.revokeOtherSessionsQuestion}\n\n${settingsCopy.account.revokeOtherSessionsWarning}`
                          );

                          if (isConfirmed) {
                            void accountSessions.revokeOtherSessions();
                          }
                        }}
                      >
                        {accountSessions.isRevokingOthers
                          ? settingsCopy.account.revokingOtherSessions
                          : settingsCopy.account.revokeOtherSessions}
                      </button>
                      <button
                        className={styles.revokeAllButton}
                        type="button"
                        disabled={
                          accountSessions.sessions.length === 0 ||
                          accountSessions.isRevokingAll ||
                          accountSessions.isRevokingOthers ||
                          Boolean(accountSessions.revokingSessionId)
                        }
                        onClick={() => {
                          if (
                            !window.confirm(
                              settingsCopy.account.revokeAllSessionsWarning
                            )
                          ) {
                            return;
                          }

                          void accountSessions
                            .revokeAllSessions()
                            .then((revoked) => {
                              if (revoked) onLogout();
                            });
                        }}
                      >
                        {accountSessions.isRevokingAll
                          ? settingsCopy.account.revokingAllSessions
                          : settingsCopy.account.revokeAllSessions}
                      </button>
                    </div>
                  </div>
                )}

                {accountSessions.isLoading && (
                  <p className={sharedStyles.statusText}>
                    {settingsCopy.account.loadingSessions}
                  </p>
                )}

                {accountSessions.error && (
                  <div className={styles.sessionError} role="alert">
                    <p className={sharedStyles.statusText}>
                      {accountSessions.error}
                    </p>
                    <button
                      className={sharedStyles.secondaryAction}
                      type="button"
                      onClick={accountSessions.retry}
                    >
                      {commonCopy.actions.retry}
                    </button>
                  </div>
                )}

                {accountSessions.actionError && (
                  <p className={styles.sessionActionError} role="alert">
                    {accountSessions.actionError}
                  </p>
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
                      session.isCurrent ||
                      session.id === currentDeviceSessionId;

                    return (
                      <article className={styles.sessionRow} key={session.id}>
                        <span>
                          <strong>
                            {session.deviceName ||
                              session.userAgent ||
                              settingsCopy.account.unknownDevice}
                          </strong>
                          <small>
                            {session.ipAddress ||
                              settingsCopy.account.ipUnknown}{' '}
                            · {settingsCopy.account.lastActivity}{' '}
                            {formatDateTime(session.lastUsedAt)}
                          </small>
                        </span>
                        {isCurrent ? (
                          <em>{settingsCopy.account.currentSession}</em>
                        ) : (
                          <button
                            className={styles.revokeSessionButton}
                            type="button"
                            disabled={
                              accountSessions.isRevokingOthers ||
                              accountSessions.isRevokingAll ||
                              Boolean(accountSessions.revokingSessionId)
                            }
                            onClick={() => {
                              const isConfirmed = window.confirm(
                                `${settingsCopy.account.revokeSessionQuestion}\n\n${settingsCopy.account.revokeSessionWarning}`
                              );

                              if (isConfirmed) {
                                void accountSessions.revokeSession(session.id);
                              }
                            }}
                          >
                            {accountSessions.revokingSessionId === session.id
                              ? settingsCopy.account.revokingSession
                              : settingsCopy.account.revokeSession}
                          </button>
                        )}
                      </article>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={settingsCopy.account.logout}>
        <button
          className={sharedStyles.dangerButton}
          type="button"
          onClick={onLogout}
        >
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
  );
}
