import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';

import type {
  CreateServerInviteRequest,
  PermissionResponse,
  ServerAuditLogResponse,
  ServerBanResponse,
  ServerInviteResponse,
  ServerJoinRequestResponse,
  ServerResponse,
  ServerRoleResponse,
  SpaceResponse,
  UpdateServerRequest
} from '../../../../shared/types';
import { ServerModerationPanel } from '../../../Moderation/components/ServerModerationPanel';
import { moderationCopy } from '../../../Moderation/moderationCopy.ru';
import { commonCopy, serverCopy, useDismissableLayer } from '../../../shared';
import { useAnimatedOverlayClose } from '../../../shared/hooks/useAnimatedOverlayClose';
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon';
import { resolveAccessibleServerCoreTab } from '../../utils/serverGovernanceCapabilities';
import type { ServerCoreTab } from '../../utils/serverWorkspaceModel';
import { compareSpaces } from '../../utils/serverWorkspaceModel';
import { ServerGeneralSettings } from './ServerGeneralSettings';
import { ServerRolesSettings } from './roles/ServerRolesSettings';

import dialogStyles from '../../../shared/styles/Dialog.module.css';
import styles from './ServerGovernance.module.css';
import settingsDialogStyles from './ServerSettingsDialog.module.css';

const serverSettingsCloseDurationMs = 200;
const modalFocusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}
export function ServerSettingsDialog({
  accessToken,
  server,
  serverTitle,
  serverCoreTab,
  spaces,
  serverInvites,
  serverJoinRequests,
  serverJoinRequestTotalCount,
  serverJoinRequestError,
  hasMoreServerJoinRequests,
  serverRoles,
  serverPermissions,
  serverAuditLogs,
  serverBans,
  currentUserPermissionCodes,
  canInviteMembers,
  canViewInviteLog,
  canViewInvites,
  canManageJoinRequests,
  canManageBans,
  canManageInvites,
  canManageRoles,
  canManageServerProfile,
  canManageServerSettings,
  canDeleteServer,
  canManageReports,
  canViewAuditLog,
  isLoadingGovernance,
  isLoadingMoreServerJoinRequests,
  isMutatingGovernance,
  onOpenServerCoreTab,
  onCreateServerInvite,
  onUpdateServer,
  onDeleteServer,
  onRevokeServerInvite,
  onLoadMoreServerJoinRequests,
  onApproveServerJoinRequest,
  onDeclineServerJoinRequest,
  onUnbanServerMember,
  onReloadServerRoles,
  onReloadServerMembers,
  onRoleDraftDirtyChange,
  onCloseSettings
}: {
  accessToken: string;
  server: ServerResponse;
  serverTitle: string;
  serverCoreTab: ServerCoreTab;
  spaces: SpaceResponse[];
  serverInvites: ServerInviteResponse[];
  serverJoinRequests: ServerJoinRequestResponse[];
  serverJoinRequestTotalCount: number;
  serverJoinRequestError: string | null;
  hasMoreServerJoinRequests: boolean;
  serverRoles: ServerRoleResponse[];
  serverPermissions: PermissionResponse[];
  serverAuditLogs: ServerAuditLogResponse[];
  serverBans: ServerBanResponse[];
  currentUserPermissionCodes: string[];
  canInviteMembers: boolean;
  canViewInviteLog: boolean;
  canViewInvites: boolean;
  canManageJoinRequests: boolean;
  canManageBans: boolean;
  canManageInvites: boolean;
  canManageRoles: boolean;
  canManageServerProfile: boolean;
  canManageServerSettings: boolean;
  canDeleteServer: boolean;
  canManageReports: boolean;
  canViewAuditLog: boolean;
  isLoadingGovernance: boolean;
  isLoadingMoreServerJoinRequests: boolean;
  isMutatingGovernance: boolean;
  onOpenServerCoreTab: (tab: ServerCoreTab) => void;
  onCreateServerInvite: (
    request?: CreateServerInviteRequest
  ) => Promise<ServerInviteResponse | null>;
  onUpdateServer: (
    request: UpdateServerRequest
  ) => Promise<ServerResponse | null>;
  onDeleteServer: () => Promise<void>;
  onRevokeServerInvite: (inviteId: string) => void;
  onLoadMoreServerJoinRequests: () => void;
  onApproveServerJoinRequest: (requestId: string) => void;
  onDeclineServerJoinRequest: (requestId: string) => void;
  onUnbanServerMember: (memberId: string) => void;
  onReloadServerRoles: () => Promise<readonly ServerRoleResponse[]>;
  onReloadServerMembers: () => Promise<void>;
  onRoleDraftDirtyChange: (isDirty: boolean) => void;
  onCloseSettings: () => void;
}) {
  const [isSavingSpaces, setIsSavingSpaces] = useState(false);
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const [isGeneralNestedOverlayOpen, setIsGeneralNestedOverlayOpen] =
    useState(false);
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const { isClosing, requestClose } = useAnimatedOverlayClose(
    serverSettingsCloseDurationMs
  );
  const closeSettings = useCallback(() => {
    requestClose(onCloseSettings);
  }, [onCloseSettings, requestClose]);
  const textSpaces = spaces
    .filter((space) => space.typeCode === 'text_room')
    .sort(compareSpaces);
  const visibleServerCoreTab = resolveAccessibleServerCoreTab(serverCoreTab, {
    canManageServerProfile,
    canManageServerSettings,
    canDeleteServer,
    canInviteMembers,
    canViewInvites,
    canManageJoinRequests,
    canManageBans,
    canManageReports,
    canManageRoles,
    canViewAuditLog
  });
  const isNestedOverlayOpen = isRoleEditorOpen || isGeneralNestedOverlayOpen;
  useDismissableLayer({
    isOpen: !isClosing && !isNestedOverlayOpen,
    layerRef: settingsDialogRef,
    onDismiss: closeSettings
  });

  useEffect(() => {
    const restoreFocusElement = restoreFocusRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function keepFocusInsideDialog(event: KeyboardEvent) {
      if (event.key !== 'Tab') {
        return;
      }

      const dialog = settingsDialogRef.current;
      if (!dialog || dialog.hasAttribute('inert')) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(modalFocusableSelector)
      ).filter((element) => element.getClientRects().length > 0);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === firstElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (
        !event.shiftKey &&
        (activeElement === lastElement || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', keepFocusInsideDialog);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', keepFocusInsideDialog);

      window.requestAnimationFrame(() => {
        if (restoreFocusElement?.isConnected) {
          restoreFocusElement.focus();
        }
      });
    };
  }, []);

  async function setDefaultTextSpace(spaceId: string | null) {
    if (!canManageServerSettings) {
      return;
    }

    setIsSavingSpaces(true);

    try {
      await onUpdateServer(
        spaceId
          ? { defaultTextSpaceId: spaceId }
          : { clearDefaultTextSpace: true }
      );
    } finally {
      setIsSavingSpaces(false);
    }
  }

  return createPortal(
    <div
      className={`${dialogStyles.backdrop} ${settingsDialogStyles.backdrop} ${
        isClosing ? settingsDialogStyles.backdropClosing : ''
      }`}
      role="presentation"
      data-state={isClosing ? 'closing' : 'open'}
      style={
        {
          '--server-settings-close-duration': `${serverSettingsCloseDurationMs}ms`
        } as CSSProperties
      }
    >
      <section
        ref={settingsDialogRef}
        className={`${dialogStyles.dialog} ${settingsDialogStyles.dialog} ${
          isClosing ? settingsDialogStyles.dialogClosing : ''
        }`}
        role="dialog"
        data-server-settings-dialog=""
        aria-modal="true"
        aria-labelledby="server-settings-title"
        aria-hidden={isNestedOverlayOpen || undefined}
        inert={isNestedOverlayOpen || undefined}
        tabIndex={-1}
      >
        <header className={settingsDialogStyles.heading}>
          <div>
            <h2 id="server-settings-title">{serverCopy.settings.title}</h2>
            <p>{serverTitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            disabled={isClosing}
            onClick={closeSettings}
            aria-label={serverCopy.settings.close}
          >
            <SystemCloseIcon size="medium" />
          </button>
        </header>

        <div className={settingsDialogStyles.shell}>
          <nav className={settingsDialogStyles.tabs}>
            {(canManageServerProfile ||
              canManageServerSettings ||
              canDeleteServer) && (
              <button
                className={
                  visibleServerCoreTab === 'general'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('general')}
              >
                {serverCopy.settings.general}
              </button>
            )}
            <button
              className={
                visibleServerCoreTab === 'spaces'
                  ? settingsDialogStyles.activeTab
                  : ''
              }
              type="button"
              onClick={() => onOpenServerCoreTab('spaces')}
            >
              {serverCopy.settings.spaces}
            </button>
            {canManageRoles && (
              <button
                className={
                  visibleServerCoreTab === 'roles'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('roles')}
              >
                {serverCopy.settings.roles}
              </button>
            )}
            {canViewInvites && (
              <button
                className={
                  visibleServerCoreTab === 'invites'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('invites')}
              >
                {serverCopy.settings.invites}
              </button>
            )}
            {canManageJoinRequests && (
              <button
                className={
                  visibleServerCoreTab === 'join-requests'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('join-requests')}
              >
                {serverCopy.settings.joinRequests}
                {serverJoinRequestTotalCount > 0 ? (
                  <span className={settingsDialogStyles.tabBadge}>
                    {serverJoinRequestTotalCount}
                  </span>
                ) : null}
              </button>
            )}
            {canManageBans && (
              <button
                className={
                  visibleServerCoreTab === 'bans'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('bans')}
              >
                {serverCopy.settings.bans}
              </button>
            )}
            {canViewAuditLog && (
              <button
                className={
                  visibleServerCoreTab === 'audit'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('audit')}
              >
                {serverCopy.settings.audit}
              </button>
            )}
            {canManageReports && (
              <button
                className={
                  visibleServerCoreTab === 'moderation'
                    ? settingsDialogStyles.activeTab
                    : ''
                }
                type="button"
                onClick={() => onOpenServerCoreTab('moderation')}
              >
                {moderationCopy.cases.tab}
              </button>
            )}
          </nav>

          <div className={settingsDialogStyles.content}>
            {visibleServerCoreTab === 'general' && (
              <ServerGeneralSettings
                accessToken={accessToken}
                server={server}
                canManageProfile={canManageServerProfile}
                canManageSettings={canManageServerSettings}
                canDelete={canDeleteServer}
                onUpdateServer={onUpdateServer}
                onDeleteServer={onDeleteServer}
                onNestedOverlayChange={setIsGeneralNestedOverlayOpen}
              />
            )}

            {visibleServerCoreTab === 'spaces' && (
              <section className={settingsDialogStyles.settingsSection}>
                <header>
                  <div>
                    <strong>{serverCopy.settings.defaultTextSpace}</strong>
                    <span>
                      {server.defaultTextSpaceId
                        ? serverCopy.settings.defaultTextSpaceUsed
                        : serverCopy.settings.defaultTextSpaceFallback}
                    </span>
                  </div>
                  <button
                    className="ui-action-button"
                    type="button"
                    disabled={
                      !canManageServerSettings ||
                      isSavingSpaces ||
                      !server.defaultTextSpaceId
                    }
                    onClick={() => void setDefaultTextSpace(null)}
                  >
                    {commonCopy.actions.reset}
                  </button>
                </header>

                {textSpaces.length === 0 ? (
                  <p className="ui-empty-state">
                    {serverCopy.settings.defaultTextSpaceEmpty}
                  </p>
                ) : (
                  <div className={settingsDialogStyles.defaultSpaceList}>
                    {textSpaces.map((space) => {
                      const isDefault = server.defaultTextSpaceId === space.id;

                      return (
                        <button
                          key={space.id}
                          className={
                            isDefault
                              ? settingsDialogStyles.defaultSpaceActive
                              : ''
                          }
                          type="button"
                          disabled={
                            !canManageServerSettings ||
                            isSavingSpaces ||
                            isDefault
                          }
                          onClick={() => void setDefaultTextSpace(space.id)}
                        >
                          <span aria-hidden="true">#</span>
                          <div>
                            <strong>{space.title}</strong>
                            <small>
                              {isDefault
                                ? serverCopy.settings.defaultTextSpaceActive
                                : serverCopy.settings.selectDefaultTextSpace}
                            </small>
                          </div>
                          {isDefault && <em>active</em>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {visibleServerCoreTab === 'invites' && canViewInvites && (
              <section className={styles.governancePanel}>
                <header>
                  <div>
                    <strong>{serverCopy.settings.invitesTitle}</strong>
                    <span>{serverInvites.length}</span>
                  </div>
                  {canInviteMembers && (
                    <button
                      className="ui-action-button"
                      type="button"
                      onClick={() => void onCreateServerInvite()}
                      disabled={isMutatingGovernance}
                    >
                      {serverCopy.settings.createInvite}
                    </button>
                  )}
                </header>
                {isLoadingGovernance ? (
                  <p className="ui-empty-state">
                    {serverCopy.settings.loadingInvites}
                  </p>
                ) : (
                  <div
                    className={`${styles.governanceList} ui-scroll-list ui-scrollbar-none`}
                  >
                    {serverInvites.map((invite) => (
                      <article className="ui-list-row" key={invite.id}>
                        <div>
                          <strong className="ui-ellipsis ui-min-ellipsis">
                            {invite.kindCode}
                          </strong>
                          <small className="ui-ellipsis ui-min-ellipsis">
                            {invite.code ??
                              invite.targetUserId ??
                              'direct invite'}
                          </small>
                        </div>
                        <span>
                          {invite.isActive
                            ? serverCopy.settings.active
                            : serverCopy.settings.inactive}
                        </span>
                        {invite.isActive &&
                          (canManageInvites ||
                            (canInviteMembers && !canViewInviteLog)) && (
                            <button
                              className="ui-action-button"
                              type="button"
                              onClick={() => onRevokeServerInvite(invite.id)}
                              disabled={isMutatingGovernance}
                            >
                              {serverCopy.settings.revoke}
                            </button>
                          )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {visibleServerCoreTab === 'join-requests' &&
              canManageJoinRequests && (
                <section
                  className={`${styles.governancePanel} ${
                    serverJoinRequestError
                      ? styles.governancePanelWithError
                      : ''
                  }`}
                >
                  <header>
                    <div>
                      <strong>{serverCopy.settings.joinRequestsTitle}</strong>
                      <span>{serverJoinRequestTotalCount}</span>
                    </div>
                  </header>
                  {serverJoinRequestError ? (
                    <p className={styles.governanceError} role="alert">
                      {serverJoinRequestError}
                    </p>
                  ) : null}
                  {isLoadingGovernance ? (
                    <p className="ui-empty-state">
                      {serverCopy.settings.loadingJoinRequests}
                    </p>
                  ) : serverJoinRequests.length === 0 &&
                    !hasMoreServerJoinRequests ? (
                    <p className="ui-empty-state">
                      {serverCopy.settings.noJoinRequests}
                    </p>
                  ) : (
                    <div
                      className={`${styles.governanceList} ui-scroll-list ui-scrollbar-none`}
                    >
                      {serverJoinRequests.map((request) => (
                        <article
                          className={`${styles.joinRequestRow} ui-list-row`}
                          key={request.id}
                        >
                          <span
                            className={styles.joinRequestAvatar}
                            aria-hidden="true"
                          >
                            {request.user.avatarAssetId ? (
                              <img
                                className="ui-media-fit"
                                src={`/api/assets/${request.user.avatarAssetId}/content`}
                                alt=""
                                style={{
                                  transform: `translate(${
                                    request.user.avatarCropOffsetX * 100
                                  }%, ${
                                    request.user.avatarCropOffsetY * 100
                                  }%) scale(${request.user.avatarCropZoom})`
                                }}
                              />
                            ) : (
                              request.user.displayName.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <div className={styles.joinRequestIdentity}>
                            <strong className="ui-ellipsis ui-min-ellipsis">
                              {request.user.displayName}
                            </strong>
                            <small className="ui-ellipsis ui-min-ellipsis">
                              @{request.user.login} ·{' '}
                              {formatDate(request.createdAt)}
                            </small>
                          </div>
                          <div className={styles.joinRequestActions}>
                            <button
                              className={styles.joinRequestDecline}
                              type="button"
                              disabled={isMutatingGovernance}
                              onClick={() =>
                                onDeclineServerJoinRequest(request.id)
                              }
                            >
                              {serverCopy.settings.declineJoinRequest}
                            </button>
                            <button
                              type="button"
                              disabled={isMutatingGovernance}
                              onClick={() =>
                                onApproveServerJoinRequest(request.id)
                              }
                            >
                              {serverCopy.settings.approveJoinRequest}
                            </button>
                          </div>
                        </article>
                      ))}
                      {hasMoreServerJoinRequests ? (
                        <button
                          className={styles.joinRequestLoadMore}
                          type="button"
                          disabled={
                            isLoadingMoreServerJoinRequests ||
                            isLoadingGovernance ||
                            isMutatingGovernance
                          }
                          aria-busy={isLoadingMoreServerJoinRequests}
                          onClick={onLoadMoreServerJoinRequests}
                        >
                          {isLoadingMoreServerJoinRequests
                            ? serverCopy.settings.loadingMoreJoinRequests
                            : serverCopy.settings.loadMoreJoinRequests}
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

            {visibleServerCoreTab === 'roles' && canManageRoles && (
              <ServerRolesSettings
                accessToken={accessToken}
                serverId={server.id}
                roles={serverRoles}
                permissions={serverPermissions}
                actorLegacyPermissionCodes={currentUserPermissionCodes}
                isLoading={isLoadingGovernance}
                onReloadRoles={onReloadServerRoles}
                onReloadMembers={onReloadServerMembers}
                onDirtyChange={onRoleDraftDirtyChange}
                onEditorOpenChange={setIsRoleEditorOpen}
              />
            )}

            {visibleServerCoreTab === 'audit' && canViewAuditLog && (
              <section className={styles.governancePanel}>
                <header>
                  <div>
                    <strong>{serverCopy.settings.serverAudit}</strong>
                    <span>{serverAuditLogs.length}</span>
                  </div>
                </header>
                {isLoadingGovernance ? (
                  <p className="ui-empty-state">
                    {serverCopy.settings.loadingLogs}
                  </p>
                ) : (
                  <div
                    className={`${styles.governanceList} ui-scroll-list ui-scrollbar-none`}
                  >
                    {serverAuditLogs.map((log) => (
                      <article className="ui-list-row" key={log.id}>
                        <div>
                          <strong className="ui-ellipsis ui-min-ellipsis">
                            {log.eventTitle}
                          </strong>
                          <small className="ui-ellipsis ui-min-ellipsis">
                            {serverCopy.settings.actor} {log.actorUserId ?? '-'}{' '}
                            · {serverCopy.settings.target}{' '}
                            {log.targetUserId ?? '-'}
                          </small>
                        </div>
                        <span>{formatDate(log.createdAt)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {visibleServerCoreTab === 'bans' && canManageBans && (
              <section className={styles.governancePanel}>
                <header>
                  <div>
                    <strong>{serverCopy.settings.bansTitle}</strong>
                    <span>{serverBans.length}</span>
                  </div>
                </header>
                {isLoadingGovernance ? (
                  <p className="ui-empty-state">
                    {serverCopy.settings.loadingBans}
                  </p>
                ) : serverBans.length === 0 ? (
                  <p className="ui-empty-state">{serverCopy.settings.noBans}</p>
                ) : (
                  <div
                    className={`${styles.governanceList} ui-scroll-list ui-scrollbar-none`}
                  >
                    {serverBans.map((ban) => (
                      <article className="ui-list-row" key={ban.memberId}>
                        <div>
                          <strong className="ui-ellipsis ui-min-ellipsis">
                            {ban.user.displayName || ban.user.login}
                          </strong>
                          <small className="ui-ellipsis ui-min-ellipsis">
                            @{ban.user.login} · {ban.reason}
                          </small>
                        </div>
                        <span>{formatDate(ban.bannedAt)}</span>
                        <button
                          className="ui-action-button"
                          type="button"
                          disabled={isMutatingGovernance}
                          onClick={() => onUnbanServerMember(ban.memberId)}
                        >
                          {serverCopy.settings.unban}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            {visibleServerCoreTab === 'moderation' && canManageReports && (
              <ServerModerationPanel
                accessToken={accessToken}
                serverId={server.id}
              />
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
