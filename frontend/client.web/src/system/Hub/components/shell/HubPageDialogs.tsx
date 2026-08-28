import { Suspense, lazy } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AssetResponse,
  ServerMemberResponse,
  UserResponse
} from '../../../../shared/types';
import type { useProfileAvatar } from '../../../Profile/hooks/useProfileAvatar';
import type { ProfileSettingsDraft } from '../../../Profile/hooks/useProfileSettings';
import type { VoiceNoiseSuppressionTelemetry } from '../../../Server/hooks/voice/useVoiceChannel';
import type { VoiceConnectionDiagnostics } from '../../../Server/hooks/voice/voiceChannelTypes';
import type { useServerDialog } from '../../../Server/hooks/workspace/useServerDialog';
import { profileCopy, serverCopy } from '../../../shared';
import type { SystemSettingsNavigationRequest } from '../../../shared/navigation/systemSettingsNavigation';

const AssetCropDialog = lazy(() =>
  import('../../../Profile/components/assets/AssetCropDialog').then(
    (module) => ({
      default: module.AssetCropDialog
    })
  )
);
const AssetLibraryDialog = lazy(() =>
  import('../../../Profile/components/assets/AssetLibraryDialog').then(
    (module) => ({
      default: module.AssetLibraryDialog
    })
  )
);
const DeleteAssetDialog = lazy(() =>
  import('../../../Profile/components/assets/DeleteAssetDialog').then(
    (module) => ({
      default: module.DeleteAssetDialog
    })
  )
);
const SystemSettingsDialog = lazy(() =>
  import('../settings/SystemSettingsDialog').then((module) => ({
    default: module.SystemSettingsDialog
  }))
);
const ServerDialog = lazy(() =>
  import('../../../Server/components/dialogs/ServerDialog').then((module) => ({
    default: module.ServerDialog
  }))
);

type AvatarSort = 'newest' | 'oldest';
type ProfileAvatarState = ReturnType<typeof useProfileAvatar>;
type ServerDialogState = ReturnType<typeof useServerDialog>;

type HubPageDialogsProps = {
  accessToken: string;
  currentDeviceSessionId?: string | null;
  user: UserResponse;
  serverMemberships: ServerMemberResponse[];
  avatarSort: AvatarSort;
  defaultProfileSettings: ProfileSettingsDraft;
  settingsDraft: ProfileSettingsDraft;
  settingsNavigationRequest: SystemSettingsNavigationRequest | null;
  voiceDiagnostics: VoiceConnectionDiagnostics | null;
  voiceNoiseSuppressionTelemetry: VoiceNoiseSuppressionTelemetry | null;
  isProfileSettingsOpen: boolean;
  isSavingProfileSettings: boolean;
  onProfileSettingsChange: Dispatch<SetStateAction<ProfileSettingsDraft>>;
  onProfileSettingsCommit: (nextDraft: ProfileSettingsDraft) => Promise<void>;
  onProfileIdentityChanged: () => Promise<void> | void;
  onProfileSettingsClose: () => void;
  onLogout: () => void;
  avatarState: ProfileAvatarState;
  serverDialogState: ServerDialogState;
  onAvatarSortChange: Dispatch<SetStateAction<AvatarSort>>;
  formatDate: (value: string) => string;
};

export function HubPageDialogs({
  accessToken,
  currentDeviceSessionId,
  user,
  serverMemberships,
  avatarSort,
  defaultProfileSettings,
  settingsDraft,
  settingsNavigationRequest,
  voiceDiagnostics,
  voiceNoiseSuppressionTelemetry,
  isProfileSettingsOpen,
  isSavingProfileSettings,
  onProfileSettingsChange,
  onProfileSettingsCommit,
  onProfileIdentityChanged,
  onProfileSettingsClose,
  onLogout,
  avatarState,
  serverDialogState,
  onAvatarSortChange,
  formatDate
}: HubPageDialogsProps) {
  const {
    publicProfile,
    avatarPicker,
    isSavingAvatar,
    avatarError,
    assetPendingDelete,
    isDeletingAsset,
    brokenAvatarUrls,
    setAssetPendingDelete,
    markBrokenAvatar,
    selectAvatarAsset,
    deleteAvatarAsset,
    cancelAvatarChange,
    confirmAvatarChange
  } = avatarState;
  const {
    serverIconInputRef,
    serverIconDraft,
    isServerIconDialogOpen,
    isServerIconLibraryOpen,
    isLoadingServerIconAssets,
    sortedServerIconAssets,
    serverDialog,
    serverForm,
    serverNotice,
    isSavingServer,
    setIsServerIconLibraryOpen,
    setServerDialog,
    updateServerForm,
    selectServerIconFile,
    clearServerIcon,
    showServerIconLibrary,
    selectServerIconAsset,
    cancelServerIconChange,
    confirmServerIconChange,
    submitServerForm
  } = serverDialogState;

  return (
    <Suspense fallback={null}>
      {serverDialog && (
        <ServerDialog
          form={serverForm}
          notice={serverNotice}
          isSaving={isSavingServer}
          iconInputRef={serverIconInputRef}
          onSubmit={submitServerForm}
          onClose={() => setServerDialog(null)}
          onUpdateForm={updateServerForm}
          onChooseIconFile={selectServerIconFile}
          onShowIconLibrary={showServerIconLibrary}
          onClearIcon={clearServerIcon}
        />
      )}

      {isProfileSettingsOpen && (
        <SystemSettingsDialog
          accessToken={accessToken}
          user={user}
          serverMemberships={serverMemberships}
          currentDeviceSessionId={currentDeviceSessionId}
          settingsDraft={settingsDraft}
          navigationRequest={settingsNavigationRequest}
          voiceDiagnostics={voiceDiagnostics}
          voiceNoiseSuppressionTelemetry={voiceNoiseSuppressionTelemetry}
          defaultSettings={defaultProfileSettings}
          isSaving={isSavingProfileSettings}
          onChange={onProfileSettingsChange}
          onCommit={onProfileSettingsCommit}
          onProfileIdentityChanged={onProfileIdentityChanged}
          onClose={onProfileSettingsClose}
          onLogout={onLogout}
        />
      )}

      {avatarPicker.isCropDialogOpen && avatarPicker.draft && (
        <AssetCropDialog
          imageUrl={avatarPicker.draft.previewUrl}
          title={profileCopy.assets.avatarCropTitle}
          description={profileCopy.assets.avatarCropDescription}
          shape="square"
          aspectRatio="1 / 1"
          frameLabel="150 x 150"
          initialCrop={
            avatarPicker.draft.assetId === publicProfile.avatarAssetId
              ? {
                  offsetX: publicProfile.avatarCropOffsetX,
                  offsetY: publicProfile.avatarCropOffsetY,
                  zoom: publicProfile.avatarCropZoom
                }
              : undefined
          }
          isSaving={isSavingAvatar}
          error={avatarError}
          onCancel={cancelAvatarChange}
          onConfirm={(crop) => void confirmAvatarChange(crop)}
          onImageError={() =>
            avatarPicker.draft &&
            markBrokenAvatar(avatarPicker.draft.previewUrl)
          }
        />
      )}

      {isServerIconDialogOpen && serverIconDraft && (
        <AssetCropDialog
          imageUrl={serverIconDraft.previewUrl}
          title={serverCopy.assets.iconCropTitle}
          description={serverCopy.assets.iconCropDescription}
          shape="rounded"
          aspectRatio="1 / 1"
          frameLabel="server icon"
          initialCrop={
            serverIconDraft.assetId === serverForm.iconAssetId ||
            (!serverIconDraft.assetId && serverIconDraft.file)
              ? {
                  offsetX: serverForm.iconCropOffsetX,
                  offsetY: serverForm.iconCropOffsetY,
                  zoom: serverForm.iconCropZoom
                }
              : undefined
          }
          isSaving={isSavingServer}
          onCancel={cancelServerIconChange}
          onConfirm={confirmServerIconChange}
        />
      )}

      {isServerIconLibraryOpen && (
        <AssetLibraryDialog
          titleId="server-icon-library-title"
          title={serverCopy.assets.iconLibraryTitle}
          description={serverCopy.assets.iconLibraryDescription}
          emptyText={serverCopy.assets.iconLibraryEmpty}
          loadingText={serverCopy.assets.iconLibraryLoading}
          assets={sortedServerIconAssets}
          isLoading={isLoadingServerIconAssets}
          sort={avatarSort}
          isRounded
          onSortChange={onAvatarSortChange}
          onClose={() => setIsServerIconLibraryOpen(false)}
          onSelectAsset={selectServerIconAsset}
          formatDate={formatDate}
        />
      )}

      {avatarPicker.isLibraryOpen && (
        <AssetLibraryDialog
          titleId="avatar-library-title"
          title={profileCopy.assets.avatarLibraryTitle}
          description={profileCopy.assets.avatarLibraryDescription}
          emptyText={profileCopy.assets.avatarLibraryEmpty}
          loadingText={profileCopy.assets.avatarLibraryLoading}
          assets={avatarPicker.sortedAssets}
          isLoading={avatarPicker.isLoadingAssets}
          sort={avatarSort}
          brokenUrls={brokenAvatarUrls}
          fallbackSrc="/brand/default-avatar.svg"
          onSortChange={onAvatarSortChange}
          onClose={() => avatarPicker.setIsLibraryOpen(false)}
          onSelectAsset={selectAvatarAsset}
          onDeleteAsset={(asset: AssetResponse) => setAssetPendingDelete(asset)}
          onBrokenUrl={markBrokenAvatar}
          formatDate={formatDate}
        />
      )}

      {assetPendingDelete && (
        <DeleteAssetDialog
          isDeleting={isDeletingAsset}
          onCancel={() => setAssetPendingDelete(null)}
          onConfirm={() => void deleteAvatarAsset(assetPendingDelete)}
        />
      )}
    </Suspense>
  );
}
