import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import { apiJson, apiNoContent } from '../../../../shared/api/api';
import type { ImageCrop } from '../../../../shared/media/ImageCropEditor';
import type {
  AssetResponse,
  DirectMessageBlockedUserResponse,
  PrivateSpaceResponse,
  ServerMemberResponse,
  UserFriendResponse
} from '../../../../shared/types';
import {
  UserBlockDialog,
  type UserBlockDialogTarget,
  communityCopy,
  dispatchUserBlockChanged,
  getUserBlockedNotice,
  profileCopy
} from '../../../shared';
import { ContextMenu } from '../../../shared/components/context-menu/ContextMenu';
import { SystemIcon } from '../../../shared/icons/SystemIcon';
import { SystemPlusIcon } from '../../../shared/icons/components/SystemPlusIcon';
import { SystemSearchInput } from '../../../shared/ui/SystemSearchInput';
import { PrivateSpaceFolderDialog } from '../private-space/folders/PrivateSpaceFolderDialog';
import { privateSpaceFolderCopy } from '../private-space/folders/privateSpaceFolderCopy.ru';
import { orderPrivateSpaces } from '../private-space/folders/privateSpaceOrderModel';
import { usePrivateSpaceFolders } from '../private-space/folders/usePrivateSpaceFolders';
import {
  type PrivateSpaceAvatarFileValidationError,
  supportedPrivateSpaceAvatarMimeTypes,
  validatePrivateSpaceAvatarFile
} from '../private-space/privateSpaceAvatarModel';
import type {
  GroupPrivateSpaceSettingsPatch,
  PrivateSpacePersonalSettingsPatch
} from '../private-space/usePrivateSpaces';
import { DirectMessagesDesktopView } from './DirectMessagesDesktopView';
import { DirectMessagesMobileView } from './DirectMessagesMobileView';
import {
  CreatePrivateSpaceDialog,
  DirectUserProfileDialog,
  GroupPrivateSpaceSettingsDialog,
  MarkAllPrivateSpacesReadDialog,
  type PrivateSpaceAction,
  PrivateSpaceActionDialog,
  PrivateSpaceTextSettingDialog
} from './PrivateSpaceDialogs';
import { filterPrivateSpacesByConversationQuery } from './directMessageModel';
import { useDirectMessageContextMenu } from './useDirectMessageContextMenu';

import styles from './DirectMessagesPanel.module.css';

const avatarAssetTypeId = '11000000-0000-0000-0000-000000000000';
const privateSpaceAvatarAccept = supportedPrivateSpaceAvatarMimeTypes.join(',');

const AssetCropDialog = lazy(() =>
  import('../../../Profile/components/assets/AssetCropDialog').then(
    (module) => ({ default: module.AssetCropDialog })
  )
);

type PrivateSpaceAvatarDraft = {
  spaceId: string;
  file: File;
  previewUrl: string;
};

export { getPrivateSpaceTitle } from './directMessageModel';

type DirectMessagesPanelProps = {
  accessToken: string;
  className?: string;
  currentUserId: string;
  activePrivateSpaceId: string | null;
  privateSpaces: PrivateSpaceResponse[];
  friends: UserFriendResponse[];
  friendUserIds: Set<string>;
  isLoadingPrivateSpaces: boolean;
  isMutatingPrivateSpaces: boolean;
  showPrivateReadAllButton: boolean;
  onOpenPrivateSpace: (spaceId: string) => void;
  onDropFilesToPrivateSpace: (spaceId: string, files: File[]) => void;
  onCreatePrivateSpace: (
    memberUserIds: string[],
    title?: string | null
  ) => Promise<PrivateSpaceResponse | null>;
  onLoadInviteTargetServers: (
    targetUserId: string
  ) => Promise<ServerMemberResponse[]>;
  onClosePrivateSpace: (spaceId: string) => Promise<void>;
  onClearPrivateSpaceHistory: (spaceId: string) => Promise<boolean>;
  onCreateDirectServerInvite: (serverId: string, targetUserId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onSendFriendRequest: (userId: string) => void;
  onUpdatePersonalSettings: (
    spaceId: string,
    request: PrivateSpacePersonalSettingsPatch
  ) => Promise<PrivateSpaceResponse>;
  onUploadPersonalAvatar: (
    spaceId: string,
    file: File,
    crop: ImageCrop
  ) => Promise<PrivateSpaceResponse>;
  onUpdateGroupSettings: (
    spaceId: string,
    request: GroupPrivateSpaceSettingsPatch
  ) => Promise<PrivateSpaceResponse>;
  onMarkPrivateSpaceRead: (spaceId: string) => Promise<void>;
  onMarkAllPrivateSpacesRead: () => Promise<{ updatedSpaceCount: number }>;
};

export function DirectMessagesPanel({
  accessToken,
  className,
  currentUserId,
  activePrivateSpaceId,
  privateSpaces,
  friends,
  friendUserIds,
  isLoadingPrivateSpaces,
  isMutatingPrivateSpaces,
  showPrivateReadAllButton,
  onOpenPrivateSpace,
  onDropFilesToPrivateSpace,
  onCreatePrivateSpace,
  onLoadInviteTargetServers,
  onClosePrivateSpace,
  onClearPrivateSpaceHistory,
  onCreateDirectServerInvite,
  onRemoveFriend,
  onSendFriendRequest,
  onUpdatePersonalSettings,
  onUploadPersonalAvatar,
  onUpdateGroupSettings,
  onMarkPrivateSpaceRead,
  onMarkAllPrivateSpacesRead
}: DirectMessagesPanelProps) {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [profileDialogSpace, setProfileDialogSpace] =
    useState<PrivateSpaceResponse | null>(null);
  const [noteDialogSpace, setNoteDialogSpace] =
    useState<PrivateSpaceResponse | null>(null);
  const [nicknameDialogSpace, setNicknameDialogSpace] =
    useState<PrivateSpaceResponse | null>(null);
  const [groupSettingsSpace, setGroupSettingsSpace] =
    useState<PrivateSpaceResponse | null>(null);
  const [customAvatarSpace, setCustomAvatarSpace] =
    useState<PrivateSpaceResponse | null>(null);
  const [customAvatarDraft, setCustomAvatarDraft] =
    useState<PrivateSpaceAvatarDraft | null>(null);
  const [customAvatarError, setCustomAvatarError] = useState<string | null>(
    null
  );
  const [isCustomAvatarSaving, setIsCustomAvatarSaving] = useState(false);
  const [userBlockDialogTarget, setUserBlockDialogTarget] =
    useState<UserBlockDialogTarget | null>(null);
  const [isUserBlockSubmitting, setIsUserBlockSubmitting] = useState(false);
  const [isReadAllDialogOpen, setIsReadAllDialogOpen] = useState(false);
  const [pendingSpaceAction, setPendingSpaceAction] = useState<{
    action: PrivateSpaceAction;
    spaceId: string;
  } | null>(null);
  const [isDialogSaving, setIsDialogSaving] = useState(false);
  const customAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isFolderRailCollapsed, setIsFolderRailCollapsed] = useState(false);
  const [conversationQuery, setConversationQuery] = useState('');
  const [folderDialog, setFolderDialog] = useState<{
    folder:
      import('../../../../shared/types').PrivateSpaceFolderResponse | null;
  } | null>(null);
  const folderController = usePrivateSpaceFolders(accessToken, privateSpaces);

  const folderPrivateSpaces = folderController.activeFolder
    ? orderPrivateSpaces(
        privateSpaces,
        folderController.activeFolder.spaceIds,
        folderController.activeFolder.isSystem
      )
    : privateSpaces;
  const visiblePrivateSpaces = filterPrivateSpacesByConversationQuery(
    folderPrivateSpaces,
    currentUserId,
    conversationQuery
  );
  const showMarkAllRead =
    showPrivateReadAllButton &&
    privateSpaces.some((space) => space.unreadCount > 0);
  const { contextMenu, contextMenuItems, openContextMenu, closeContextMenu } =
    useDirectMessageContextMenu({
      currentUserId,
      friendUserIds,
      isMutatingPrivateSpaces:
        isMutatingPrivateSpaces ||
        folderController.isMutating ||
        isDialogSaving ||
        isCustomAvatarSaving ||
        isUserBlockSubmitting,
      pinnedSpaceIds: new Set(
        folderController.activeFolder?.pinnedSpaceIds ?? []
      ),
      folders: folderController.folders,
      onAddToFolder: (folderId, spaceId) => {
        void folderController.addSpaceToFolder(folderId, spaceId);
      },
      onRemoveFromFolder: (folderId, spaceId) => {
        void folderController.removeSpaceFromFolder(folderId, spaceId);
      },
      onOpenUserProfile: setProfileDialogSpace,
      onOpenNote: setNoteDialogSpace,
      onOpenNickname: setNicknameDialogSpace,
      onChooseCustomAvatar: (space) => {
        setCustomAvatarError(null);
        setCustomAvatarSpace(space);
        window.requestAnimationFrame(() =>
          customAvatarInputRef.current?.click()
        );
      },
      onClearCustomAvatar: (spaceId) => {
        void savePersonalSettings(spaceId, { clearCustomAvatar: true });
      },
      onOpenGroupSettings: setGroupSettingsSpace,
      onTogglePin: (spaceId, isPinned) => {
        void folderController.setPinned(spaceId, isPinned);
      },
      onSetMute: (spaceId, muteMode) => {
        void savePersonalSettings(spaceId, { muteMode });
      },
      onMarkRead: (spaceId) => {
        void onMarkPrivateSpaceRead(spaceId);
      },
      onBlockUser: (member) => {
        setUserBlockDialogTarget({
          userId: member.userId,
          displayName: member.user.displayName,
          login: member.user.login
        });
      },
      onUnblockUser: (member) => {
        void unblockUser({
          userId: member.userId,
          displayName: member.user.displayName,
          login: member.user.login
        });
      },
      onSendFriendRequest,
      onLoadInviteTargetServers,
      onRequestClearHistory: (space) =>
        setPendingSpaceAction({
          action: 'clear-history',
          spaceId: space.spaceId
        }),
      onRequestLeaveGroup: (space) =>
        setPendingSpaceAction({
          action: 'leave-group',
          spaceId: space.spaceId
        }),
      onRequestDeleteDirect: (space) =>
        setPendingSpaceAction({
          action: 'delete-direct',
          spaceId: space.spaceId
        }),
      onCreateDirectServerInvite,
      onRemoveFriend
    });

  useEffect(() => {
    if (!isCreateMenuOpen) {
      return undefined;
    }

    function closeByKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCreateMenuOpen(false);
      }
    }

    window.addEventListener('keydown', closeByKey);

    return () => {
      window.removeEventListener('keydown', closeByKey);
    };
  }, [isCreateMenuOpen]);

  useEffect(() => {
    const previewUrl = customAvatarDraft?.previewUrl;
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [customAvatarDraft?.previewUrl]);

  return (
    <aside
      className={`${styles.panel} ${className ?? ''} ui-panel`}
      aria-label={communityCopy.direct.title}
    >
      <div className={styles.desktopSearchControl}>
        <div className={styles.conversationSearchRow}>
          <SystemSearchInput
            className={styles.conversationSearchInput}
            name="directConversationSearch"
            aria-label={privateSpaceFolderCopy.panelSearch}
            placeholder={privateSpaceFolderCopy.panelSearch}
            value={conversationQuery}
            onChange={(event) => setConversationQuery(event.target.value)}
          />
          <div className={styles.searchActions}>
            <button
              type="button"
              aria-label={privateSpaceFolderCopy.create}
              title={privateSpaceFolderCopy.create}
              disabled={folderController.isMutating}
              onClick={onCreateFolderFromSearch}
            >
              <SystemIcon name="folder" size={17} />
            </button>
            <span className={styles.folderControlDivider} aria-hidden="true" />
            <button
              className={`${styles.folderToggle} ${isFolderRailCollapsed ? styles.folderToggleCollapsed : ''}`}
              type="button"
              aria-label={
                isFolderRailCollapsed
                  ? privateSpaceFolderCopy.expand
                  : privateSpaceFolderCopy.collapse
              }
              title={
                isFolderRailCollapsed
                  ? privateSpaceFolderCopy.expand
                  : privateSpaceFolderCopy.collapse
              }
              aria-expanded={!isFolderRailCollapsed}
              onClick={() => setIsFolderRailCollapsed((current) => !current)}
            >
              <SystemIcon name="chevron-down" size={15} />
            </button>
            <button
              type="button"
              aria-label={communityCopy.direct.createDirectMessage}
              title={communityCopy.direct.createDirectMessage}
              disabled={isMutatingPrivateSpaces}
              onClick={() => setIsCreateMenuOpen((current) => !current)}
            >
              <SystemPlusIcon size="small" />
            </button>
          </div>
        </div>
      </div>
      <DirectMessagesMobileView
        currentUserId={currentUserId}
        activePrivateSpaceId={activePrivateSpaceId}
        privateSpaces={visiblePrivateSpaces}
        folderController={folderController}
        onCreateFolder={() => setFolderDialog({ folder: null })}
        onEditFolder={(folder) => setFolderDialog({ folder })}
        isLoadingPrivateSpaces={isLoadingPrivateSpaces}
        isMutatingPrivateSpaces={isMutatingPrivateSpaces}
        conversationQuery={conversationQuery}
        onConversationQueryChange={setConversationQuery}
        onToggleCreate={() => setIsCreateMenuOpen((current) => !current)}
        onOpenPrivateSpace={onOpenPrivateSpace}
        onDropFilesToPrivateSpace={onDropFilesToPrivateSpace}
        onOpenContextMenu={(event, space) =>
          openContextMenu(event, space, folderController.activeFolderId)
        }
        onMarkAllRead={
          showMarkAllRead ? () => setIsReadAllDialogOpen(true) : undefined
        }
        markAllReadDisabled={isDialogSaving || isMutatingPrivateSpaces}
      />

      <DirectMessagesDesktopView
        currentUserId={currentUserId}
        activePrivateSpaceId={activePrivateSpaceId}
        privateSpaces={visiblePrivateSpaces}
        folderController={folderController}
        isFolderRailCollapsed={isFolderRailCollapsed}
        onEditFolder={(folder) => setFolderDialog({ folder })}
        isLoadingPrivateSpaces={isLoadingPrivateSpaces}
        onOpenPrivateSpace={onOpenPrivateSpace}
        onDropFilesToPrivateSpace={onDropFilesToPrivateSpace}
        onOpenContextMenu={(event, space) =>
          openContextMenu(event, space, folderController.activeFolderId)
        }
        onMarkAllRead={
          showMarkAllRead ? () => setIsReadAllDialogOpen(true) : undefined
        }
        markAllReadDisabled={isDialogSaving || isMutatingPrivateSpaces}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}

      {isCreateMenuOpen && (
        <CreatePrivateSpaceDialog
          friends={friends}
          isSaving={isDialogSaving || isMutatingPrivateSpaces}
          onClose={() => setIsCreateMenuOpen(false)}
          onCreate={createPrivateSpace}
        />
      )}
      {profileDialogSpace && (
        <DirectUserProfileDialog
          accessToken={accessToken}
          currentUserId={currentUserId}
          space={profileDialogSpace}
          onClose={() => setProfileDialogSpace(null)}
        />
      )}
      {noteDialogSpace && (
        <PrivateSpaceTextSettingDialog
          title={communityCopy.direct.noteDialogTitle}
          label={communityCopy.direct.noteLabel}
          initialValue={noteDialogSpace.viewerSettings.note}
          placeholder={communityCopy.direct.notePlaceholder}
          isSaving={isDialogSaving}
          onClose={() => setNoteDialogSpace(null)}
          onSave={async (value) => {
            const saved = await savePersonalSettings(noteDialogSpace.spaceId, {
              note: value,
              clearNote: value == null
            });
            if (saved) setNoteDialogSpace(null);
          }}
        />
      )}
      {nicknameDialogSpace && (
        <PrivateSpaceTextSettingDialog
          title={communityCopy.direct.nicknameDialogTitle}
          label={communityCopy.direct.nicknameLabel}
          initialValue={nicknameDialogSpace.viewerSettings.customNickname}
          placeholder={communityCopy.direct.nicknamePlaceholder}
          isSaving={isDialogSaving}
          onClose={() => setNicknameDialogSpace(null)}
          onSave={async (value) => {
            const saved = await savePersonalSettings(
              nicknameDialogSpace.spaceId,
              {
                customNickname: value,
                clearCustomNickname: value == null
              }
            );
            if (saved) setNicknameDialogSpace(null);
          }}
        />
      )}
      {groupSettingsSpace && (
        <GroupPrivateSpaceSettingsDialog
          space={groupSettingsSpace}
          isSaving={isDialogSaving}
          onClose={() => setGroupSettingsSpace(null)}
          onSave={(value) => saveGroupSettings(groupSettingsSpace, value)}
        />
      )}
      {isReadAllDialogOpen && (
        <MarkAllPrivateSpacesReadDialog
          isSaving={isDialogSaving}
          onClose={() => setIsReadAllDialogOpen(false)}
          onConfirm={markAllPrivateSpacesRead}
        />
      )}
      {pendingSpaceAction && (
        <PrivateSpaceActionDialog
          action={pendingSpaceAction.action}
          isSaving={isDialogSaving || isMutatingPrivateSpaces}
          onClose={() => setPendingSpaceAction(null)}
          onConfirm={confirmPrivateSpaceAction}
        />
      )}
      <input
        ref={customAvatarInputRef}
        className={styles.hiddenFileInput}
        type="file"
        accept={privateSpaceAvatarAccept}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          selectCustomAvatarFile(file);
          event.target.value = '';
        }}
      />
      {customAvatarDraft && (
        <Suspense fallback={null}>
          <AssetCropDialog
            imageUrl={customAvatarDraft.previewUrl}
            title={communityCopy.direct.personalAvatarTitle}
            description={communityCopy.direct.personalAvatarDescription}
            shape="rounded"
            aspectRatio="1 / 1"
            frameLabel="150 x 150"
            isSaving={isCustomAvatarSaving}
            error={customAvatarError}
            onCancel={cancelCustomAvatarChange}
            onConfirm={(crop) => void confirmCustomAvatarChange(crop)}
            onImageError={() =>
              setCustomAvatarError(
                communityCopy.direct.personalAvatarOpenFailed
              )
            }
          />
        </Suspense>
      )}
      {userBlockDialogTarget && (
        <UserBlockDialog
          target={userBlockDialogTarget}
          isSubmitting={isUserBlockSubmitting}
          onClose={() => setUserBlockDialogTarget(null)}
          onConfirm={(comment) => blockUser(userBlockDialogTarget, comment)}
        />
      )}
      {folderDialog && (
        <PrivateSpaceFolderDialog
          currentUserId={currentUserId}
          folder={folderDialog.folder}
          privateSpaces={privateSpaces}
          isSaving={folderController.isMutating}
          error={folderController.error}
          onClose={() => setFolderDialog(null)}
          onSave={async (request) => {
            if (folderDialog.folder) {
              await folderController.updateFolder(
                folderDialog.folder.id,
                request
              );
            } else {
              await folderController.createFolder(request);
            }
            setFolderDialog(null);
          }}
        />
      )}
    </aside>
  );

  async function createPrivateSpace(
    memberUserIds: string[],
    title?: string | null
  ) {
    setIsDialogSaving(true);
    try {
      const createdSpace = await onCreatePrivateSpace(memberUserIds, title);
      if (!createdSpace) return;
      setIsCreateMenuOpen(false);
      onOpenPrivateSpace(createdSpace.spaceId);
    } catch (error) {
      showDialogError(error, communityCopy.direct.createFailed);
    } finally {
      setIsDialogSaving(false);
    }
  }

  async function savePersonalSettings(
    spaceId: string,
    request: PrivateSpacePersonalSettingsPatch
  ) {
    setIsDialogSaving(true);
    try {
      await onUpdatePersonalSettings(spaceId, request);
      return true;
    } catch (error) {
      showDialogError(error, communityCopy.direct.settingsSaveFailed);
      return false;
    } finally {
      setIsDialogSaving(false);
    }
  }

  function selectCustomAvatarFile(file: File | undefined) {
    if (!file || !customAvatarSpace) {
      return;
    }

    const validationError = validatePrivateSpaceAvatarFile(file);
    if (validationError) {
      showSystemNotice(getPrivateSpaceAvatarFileError(validationError));
      setCustomAvatarSpace(null);
      return;
    }

    setCustomAvatarError(null);
    setCustomAvatarDraft({
      spaceId: customAvatarSpace.spaceId,
      file,
      previewUrl: URL.createObjectURL(file)
    });
  }

  function cancelCustomAvatarChange() {
    if (isCustomAvatarSaving) {
      return;
    }

    setCustomAvatarDraft(null);
    setCustomAvatarSpace(null);
    setCustomAvatarError(null);
  }

  async function confirmCustomAvatarChange(crop: ImageCrop) {
    if (!customAvatarDraft) {
      return;
    }

    const validationError = validatePrivateSpaceAvatarFile(
      customAvatarDraft.file
    );
    if (validationError) {
      setCustomAvatarError(getPrivateSpaceAvatarFileError(validationError));
      return;
    }

    setIsCustomAvatarSaving(true);
    setCustomAvatarError(null);
    try {
      await onUploadPersonalAvatar(
        customAvatarDraft.spaceId,
        customAvatarDraft.file,
        crop
      );
      setCustomAvatarDraft(null);
      setCustomAvatarSpace(null);
    } catch {
      setCustomAvatarError(profileCopy.errors.avatarSaveFailed);
    } finally {
      setIsCustomAvatarSaving(false);
    }
  }

  async function uploadGroupAvatarAsset(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error(communityCopy.direct.selectedFileIsNotImage);
    }

    const formData = new FormData();
    formData.append('AssetTypeId', avatarAssetTypeId);
    formData.append('File', file);
    return apiJson<AssetResponse>('/api/assets/upload', {
      method: 'POST',
      accessToken,
      body: formData
    });
  }

  async function saveGroupSettings(
    space: PrivateSpaceResponse,
    value: {
      title: string;
      description: string;
      avatarFile: File | null;
      clearAvatar: boolean;
    }
  ) {
    setIsDialogSaving(true);
    try {
      const request: GroupPrivateSpaceSettingsPatch = {
        title: value.title.trim() || null,
        clearTitle: value.title.trim().length === 0,
        description: value.description.trim() || null,
        clearDescription: value.description.trim().length === 0
      };

      if (value.avatarFile) {
        const asset = await uploadGroupAvatarAsset(value.avatarFile);
        request.avatarAssetId = asset.id;
        request.avatarCropOffsetX = 0;
        request.avatarCropOffsetY = 0;
        request.avatarCropZoom = 1;
      } else if (value.clearAvatar) {
        request.clearAvatar = true;
      }

      await onUpdateGroupSettings(space.spaceId, request);
      setGroupSettingsSpace(null);
    } catch (error) {
      showDialogError(error, communityCopy.direct.groupSettingsSaveFailed);
    } finally {
      setIsDialogSaving(false);
    }
  }

  async function blockUser(
    target: UserBlockDialogTarget,
    comment: string | null
  ) {
    setIsUserBlockSubmitting(true);
    try {
      const blockedUser = await apiJson<DirectMessageBlockedUserResponse>(
        `/api/users/me/direct-message-blocks/${target.userId}`,
        {
          method: 'PUT',
          accessToken,
          body: { comment }
        }
      );
      dispatchUserBlockChanged({
        userId: target.userId,
        isBlocked: true,
        comment: blockedUser.comment
      });
      setUserBlockDialogTarget(null);
      showSystemNotice(
        getUserBlockedNotice(target.displayName, blockedUser.comment)
      );
    } catch (error) {
      showDialogError(error, communityCopy.direct.blockFailed);
    } finally {
      setIsUserBlockSubmitting(false);
    }
  }

  async function unblockUser(target: UserBlockDialogTarget) {
    setIsUserBlockSubmitting(true);
    try {
      await apiNoContent(
        `/api/users/me/direct-message-blocks/${target.userId}`,
        {
          method: 'DELETE',
          accessToken
        }
      );
      dispatchUserBlockChanged({
        userId: target.userId,
        isBlocked: false,
        comment: null
      });
      showSystemNotice(
        communityCopy.direct.userUnblockedNotice(
          target.displayName.trim() || communityCopy.direct.userFallback
        )
      );
    } catch (error) {
      showDialogError(error, communityCopy.direct.unblockFailed);
    } finally {
      setIsUserBlockSubmitting(false);
    }
  }

  async function markAllPrivateSpacesRead() {
    setIsDialogSaving(true);
    try {
      await onMarkAllPrivateSpacesRead();
      setIsReadAllDialogOpen(false);
    } catch (error) {
      showDialogError(error, communityCopy.direct.markAllReadFailed);
    } finally {
      setIsDialogSaving(false);
    }
  }

  async function confirmPrivateSpaceAction() {
    if (!pendingSpaceAction) return;

    setIsDialogSaving(true);
    try {
      if (pendingSpaceAction.action === 'clear-history') {
        const wasCleared = await onClearPrivateSpaceHistory(
          pendingSpaceAction.spaceId
        );
        if (!wasCleared) return;
      } else {
        await onClosePrivateSpace(pendingSpaceAction.spaceId);
      }

      setPendingSpaceAction(null);
    } catch (error) {
      const fallback =
        pendingSpaceAction.action === 'leave-group'
          ? communityCopy.direct.leaveGroupFailed
          : pendingSpaceAction.action === 'delete-direct'
            ? communityCopy.direct.deleteDirectFailed
            : communityCopy.direct.clearHistoryFailed;
      showDialogError(error, fallback);
    } finally {
      setIsDialogSaving(false);
    }
  }

  function onCreateFolderFromSearch() {
    setFolderDialog({ folder: null });
  }
}

function showDialogError(_error: unknown, fallback: string) {
  showSystemNotice(fallback);
}

function getPrivateSpaceAvatarFileError(
  error: PrivateSpaceAvatarFileValidationError
) {
  return error === 'too-large'
    ? profileCopy.errors.avatarTooLarge
    : profileCopy.errors.avatarUnsupportedType;
}

function showSystemNotice(body: string) {
  window.dispatchEvent(
    new CustomEvent('arcanelink:system-notification', {
      detail: {
        id: `private-space-settings:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2)}`,
        title: communityCopy.direct.noticeTitle,
        body,
        force: true
      }
    })
  );
}
