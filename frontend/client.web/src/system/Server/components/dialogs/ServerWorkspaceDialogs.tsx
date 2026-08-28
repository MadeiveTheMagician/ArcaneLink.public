import { useEffect } from 'react';

import type {
  CreateServerInviteRequest,
  PermissionResponse,
  ServerInviteResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerRoleResponse,
  SpacePermissionOverrideResponse,
  SpaceResponse,
  UpsertSpacePermissionOverrideRequest,
  UserFriendResponse
} from '../../../../shared/types';
import { commonCopy, serverCopy } from '../../../shared/copy';
import { SystemCloseIcon } from '../../../shared/icons/components/SystemCloseIcon';
import type {
  CreateSpaceDialogState,
  EditSpaceDialogState
} from '../../hooks/workspace/useServerSpaceDialogs';
import { ServerInviteDialog } from './ServerInviteDialog';
import { SpacePermissionEditor } from './space-permissions/SpacePermissionEditor';

import buttonStyles from '../../../shared/styles/Button.module.css';
import dialogStyles from '../../../shared/styles/Dialog.module.css';
import dialogModuleStyles from './ServerWorkspaceDialogs.module.css';

type ServerWorkspaceDialogsProps = {
  server: ServerMemberResponse['server'];
  serverMembers: ServerMemberDetailsResponse[];
  serverRoles: ServerRoleResponse[];
  serverSpaces: SpaceResponse[];
  spacePermissions: PermissionResponse[];
  serverInvites: ServerInviteResponse[];
  friends: UserFriendResponse[];
  canInviteMembers: boolean;
  isInviteDialogOpen: boolean;
  isLoadingInviteDialog: boolean;
  inviteDialogLoadError: string | null;
  isMutatingGovernance: boolean;
  isMutatingSpaces: boolean;
  pendingOwnershipTransfer: ServerMemberDetailsResponse | null;
  createSpaceDialog: CreateSpaceDialogState | null;
  editSpaceDialog: EditSpaceDialogState | null;
  pendingDeleteSpace: SpaceResponse | null;
  spaceTitleDraft: string;
  spaceDescriptionDraft: string;
  onCreateServerInvite: (
    request?: CreateServerInviteRequest
  ) => Promise<ServerInviteResponse | null>;
  onCloseInviteDialog: () => void;
  onCloseOwnershipTransfer: () => void;
  onConfirmOwnershipTransfer: (member: ServerMemberDetailsResponse) => void;
  onCloseCreateSpaceDialog: () => void;
  onCloseEditSpaceDialog: () => void;
  onCloseDeleteSpaceDialog: () => void;
  onSetSpaceTitleDraft: (title: string) => void;
  onSetSpaceDescriptionDraft: (description: string) => void;
  onSubmitCreateSpace: () => void;
  onSubmitEditSpace: () => void;
  onDeleteSpace: (space: SpaceResponse, action: 'delete' | 'promote') => void;
  onUpsertSpacePermissionOverride: (
    spaceId: string,
    request: UpsertSpacePermissionOverrideRequest
  ) => Promise<SpacePermissionOverrideResponse | null>;
  onDeleteSpacePermissionOverride: (
    spaceId: string,
    overrideId: string
  ) => Promise<boolean>;
};

export function ServerWorkspaceDialogs({
  server,
  serverMembers,
  serverRoles,
  serverSpaces,
  spacePermissions,
  serverInvites,
  friends,
  canInviteMembers,
  isInviteDialogOpen,
  isLoadingInviteDialog,
  inviteDialogLoadError,
  isMutatingGovernance,
  isMutatingSpaces,
  pendingOwnershipTransfer,
  createSpaceDialog,
  editSpaceDialog,
  pendingDeleteSpace,
  spaceTitleDraft,
  spaceDescriptionDraft,
  onCreateServerInvite,
  onCloseInviteDialog,
  onCloseOwnershipTransfer,
  onConfirmOwnershipTransfer,
  onCloseCreateSpaceDialog,
  onCloseEditSpaceDialog,
  onCloseDeleteSpaceDialog,
  onSetSpaceTitleDraft,
  onSetSpaceDescriptionDraft,
  onSubmitCreateSpace,
  onSubmitEditSpace,
  onDeleteSpace,
  onUpsertSpacePermissionOverride,
  onDeleteSpacePermissionOverride
}: ServerWorkspaceDialogsProps) {
  const editableSpace = editSpaceDialog
    ? (serverSpaces.find((space) => space.id === editSpaceDialog.space.id) ??
      null)
    : null;

  useEffect(() => {
    if (
      editSpaceDialog &&
      !isMutatingSpaces &&
      (!editableSpace || !editableSpace.effectiveCapabilities.canManageSpace)
    ) {
      onCloseEditSpaceDialog();
    }
  }, [
    editSpaceDialog,
    editableSpace,
    isMutatingSpaces,
    onCloseEditSpaceDialog
  ]);

  return (
    <>
      {isInviteDialogOpen && (
        <ServerInviteDialog
          server={server}
          invites={serverInvites}
          friends={friends}
          canInviteMembers={canInviteMembers}
          isLoading={isLoadingInviteDialog}
          loadError={inviteDialogLoadError}
          isMutating={isMutatingGovernance}
          onCreateInvite={onCreateServerInvite}
          onClose={onCloseInviteDialog}
        />
      )}

      {pendingOwnershipTransfer && (
        <div className={dialogStyles.backdrop} role="presentation">
          <section
            className={`${dialogStyles.dialog} ${dialogModuleStyles.confirmDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-owner-title"
          >
            <span className={dialogModuleStyles.confirmMark}>!</span>
            <h2 id="transfer-owner-title">
              {serverCopy.workspaceDialogs.transferOwnershipQuestion}
            </h2>
            <p>
              {serverCopy.workspaceDialogs.transferOwnershipWarning(
                server.title,
                pendingOwnershipTransfer.user.displayName
              )}
            </p>
            <div className={dialogModuleStyles.actions}>
              <button
                className={`${buttonStyles.button} ${buttonStyles.ghost} ${dialogModuleStyles.actionButton}`}
                type="button"
                onClick={onCloseOwnershipTransfer}
              >
                {commonCopy.actions.cancel}
              </button>
              <button
                className={`${buttonStyles.button} ${buttonStyles.primary} ${dialogModuleStyles.actionButton}`}
                type="button"
                disabled={isMutatingGovernance}
                onClick={() =>
                  onConfirmOwnershipTransfer(pendingOwnershipTransfer)
                }
              >
                {serverCopy.workspaceDialogs.transferOwnership}
              </button>
            </div>
          </section>
        </div>
      )}

      {createSpaceDialog && (
        <div className={dialogStyles.backdrop} role="presentation">
          <section
            className={`${dialogStyles.dialog} ${dialogModuleStyles.createDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-space-title"
          >
            <header className={dialogModuleStyles.dialogHeader}>
              <div>
                <h2 id="create-space-title">
                  {createSpaceDialog.typeCode === 'category'
                    ? serverCopy.workspaceDialogs.createCategory
                    : createSpaceDialog.typeCode === 'voice_room'
                      ? serverCopy.workspaceDialogs.createVoiceSpace
                      : serverCopy.workspaceDialogs.createTextSpace}
                </h2>
                <p>{server.title}</p>
              </div>
              <button
                type="button"
                onClick={onCloseCreateSpaceDialog}
                aria-label={serverCopy.workspaceDialogs.closeCreateSpace}
              >
                <SystemCloseIcon size="medium" />
              </button>
            </header>
            <div className={dialogModuleStyles.createSpaceForm}>
              <input
                className="ui-field-control"
                name="spaceTitle"
                value={spaceTitleDraft}
                onChange={(event) => onSetSpaceTitleDraft(event.target.value)}
                placeholder={serverCopy.workspaceDialogs.spaceTitlePlaceholder}
                maxLength={128}
              />
              <input
                className="ui-field-control"
                name="spaceDescription"
                value={spaceDescriptionDraft}
                onChange={(event) =>
                  onSetSpaceDescriptionDraft(event.target.value)
                }
                placeholder={
                  serverCopy.workspaceDialogs.spaceDescriptionPlaceholder
                }
                maxLength={512}
              />
              <button
                type="button"
                disabled={isMutatingSpaces || !spaceTitleDraft.trim()}
                onClick={onSubmitCreateSpace}
              >
                {isMutatingSpaces
                  ? serverCopy.workspaceDialogs.creatingSpace
                  : serverCopy.workspaceDialogs.createSpace}
              </button>
            </div>
          </section>
        </div>
      )}

      {editSpaceDialog &&
        editableSpace?.effectiveCapabilities.canManageSpace && (
          <div className={dialogStyles.backdrop} role="presentation">
            <section
              className={`${dialogStyles.dialog} ${dialogModuleStyles.editDialog}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-space-title"
            >
              <header className={dialogModuleStyles.dialogHeader}>
                <div>
                  <h2 id="edit-space-title">
                    {editableSpace.typeCode === 'category'
                      ? serverCopy.workspaceDialogs.editCategory
                      : serverCopy.workspaceDialogs.editSpace}
                  </h2>
                  <p>{editableSpace.title}</p>
                </div>
                <button
                  type="button"
                  onClick={onCloseEditSpaceDialog}
                  aria-label={serverCopy.workspaceDialogs.closeEditSpace}
                >
                  <SystemCloseIcon size="medium" />
                </button>
              </header>
              <div className={dialogModuleStyles.createSpaceForm}>
                <input
                  className="ui-field-control"
                  name="spaceTitle"
                  value={spaceTitleDraft}
                  onChange={(event) => onSetSpaceTitleDraft(event.target.value)}
                  placeholder={serverCopy.workspaceDialogs.titlePlaceholder}
                  maxLength={128}
                />
                <input
                  className="ui-field-control"
                  name="spaceDescription"
                  value={spaceDescriptionDraft}
                  onChange={(event) =>
                    onSetSpaceDescriptionDraft(event.target.value)
                  }
                  placeholder={
                    serverCopy.workspaceDialogs.descriptionPlaceholder
                  }
                  maxLength={512}
                />
                <button
                  type="button"
                  disabled={isMutatingSpaces || !spaceTitleDraft.trim()}
                  onClick={onSubmitEditSpace}
                >
                  {isMutatingSpaces
                    ? serverCopy.workspaceDialogs.savingSpace
                    : serverCopy.workspaceDialogs.saveSpace}
                </button>
              </div>
              <SpacePermissionEditor
                space={editableSpace}
                permissions={spacePermissions}
                roles={serverRoles}
                members={serverMembers}
                isMutating={isMutatingSpaces}
                onUpsert={onUpsertSpacePermissionOverride}
                onDelete={onDeleteSpacePermissionOverride}
              />
            </section>
          </div>
        )}

      {pendingDeleteSpace && (
        <div className={dialogStyles.backdrop} role="presentation">
          <section
            className={`${dialogStyles.dialog} ${dialogModuleStyles.createDialog}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-space-title"
          >
            <header className={dialogModuleStyles.dialogHeader}>
              <div>
                <h2 id="delete-space-title">
                  {serverCopy.workspaceDialogs.deleteSpaceTitle(
                    pendingDeleteSpace.typeCode === 'category'
                      ? serverCopy.workspaceDialogs.category
                      : serverCopy.workspaceDialogs.space
                  )}
                </h2>
                <p>{pendingDeleteSpace.title}</p>
              </div>
              <button
                type="button"
                onClick={onCloseDeleteSpaceDialog}
                aria-label={serverCopy.workspaceDialogs.closeDeleteSpace}
              >
                <SystemCloseIcon size="medium" />
              </button>
            </header>
            <div className={dialogModuleStyles.createSpaceForm}>
              {pendingDeleteSpace.typeCode === 'category' &&
              serverSpaces.some(
                (space) => space.parentSpaceId === pendingDeleteSpace.id
              ) ? (
                <>
                  <p>{serverCopy.workspaceDialogs.deleteNestedCategoryBody}</p>
                  <button
                    type="button"
                    disabled={isMutatingSpaces}
                    onClick={() => onDeleteSpace(pendingDeleteSpace, 'promote')}
                  >
                    {serverCopy.workspaceDialogs.promoteChildren}
                  </button>
                  <button
                    type="button"
                    disabled={isMutatingSpaces}
                    onClick={() => onDeleteSpace(pendingDeleteSpace, 'delete')}
                  >
                    {serverCopy.workspaceDialogs.deleteWithChildren}
                  </button>
                </>
              ) : (
                <>
                  <p>{serverCopy.workspaceDialogs.deleteSpaceBody}</p>
                  <button
                    type="button"
                    disabled={isMutatingSpaces}
                    onClick={() => onDeleteSpace(pendingDeleteSpace, 'delete')}
                  >
                    {serverCopy.workspaceDialogs.deleteSpace}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
