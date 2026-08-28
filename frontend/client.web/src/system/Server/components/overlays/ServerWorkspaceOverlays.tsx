import type {
  CreateServerInviteRequest,
  PermissionResponse,
  ServerAuditLogResponse,
  ServerBanResponse,
  ServerInviteResponse,
  ServerJoinRequestResponse,
  ServerMemberDetailsResponse,
  ServerMemberResponse,
  ServerResponse,
  ServerRoleResponse,
  SpacePermissionOverrideResponse,
  SpaceResponse,
  UpsertSpacePermissionOverrideRequest,
  UpdateServerRequest,
  UserFriendResponse,
} from '../../../../shared/types'
import { ContextMenu, type ContextMenuItem } from '../../../shared/components/context-menu/ContextMenu'
import type {
  MemberContextMenuState,
  SpaceContextMenuState,
  VoiceParticipantContextMenuState,
} from '../../hooks/workspace/useServerWorkspaceContextMenus'
import type { ServerCoreTab } from '../../utils/serverWorkspaceModel'
import { ServerWorkspaceDialogs } from '../dialogs/ServerWorkspaceDialogs'
import type {
  CreateSpaceDialogState,
  EditSpaceDialogState,
} from '../../hooks/workspace/useServerSpaceDialogs'
import { ServerSettingsDialog } from '../settings/ServerSettingsDialog'

type ServerWorkspaceOverlaysProps = {
  accessToken: string
  server: ServerMemberResponse['server']
  serverMembers: ServerMemberDetailsResponse[]
  serverSpaces: SpaceResponse[]
  spacePermissions: PermissionResponse[]
  serverInvites: ServerInviteResponse[]
  serverJoinRequests: ServerJoinRequestResponse[]
  serverJoinRequestTotalCount: number
  serverJoinRequestError: string | null
  hasMoreServerJoinRequests: boolean
  friends: UserFriendResponse[]
  canInviteMembers: boolean
  canViewInviteLog: boolean
  canViewInvites: boolean
  canManageJoinRequests: boolean
  canManageBans: boolean
  canManageInvites: boolean
  canManageRoles: boolean
  canManageServerProfile: boolean
  canManageServerSettings: boolean
  canDeleteServer: boolean
  canManageReports: boolean
  canViewAuditLog: boolean
  currentUserPermissionCodes: string[]
  isInviteDialogOpen: boolean
  isLoadingInviteDialog: boolean
  inviteDialogLoadError: string | null
  isLoadingGovernance: boolean
  isLoadingMoreServerJoinRequests: boolean
  isMutatingGovernance: boolean
  isMutatingSpaces: boolean
  pendingOwnershipTransfer: ServerMemberDetailsResponse | null
  createSpaceDialog: CreateSpaceDialogState | null
  editSpaceDialog: EditSpaceDialogState | null
  pendingDeleteSpace: SpaceResponse | null
  spaceTitleDraft: string
  spaceDescriptionDraft: string
  memberContextMenu: MemberContextMenuState | null
  spaceContextMenu: SpaceContextMenuState | null
  voiceParticipantContextMenu: VoiceParticipantContextMenuState | null
  memberContextItems: ContextMenuItem[]
  spaceContextItems: ContextMenuItem[]
  voiceParticipantContextItems: ContextMenuItem[]
  isSettingsOpen: boolean
  serverCoreTab: ServerCoreTab
  serverRoles: ServerRoleResponse[]
  serverPermissions: PermissionResponse[]
  serverAuditLogs: ServerAuditLogResponse[]
  serverBans: ServerBanResponse[]
  onCreateServerInvite: (
    request?: CreateServerInviteRequest,
  ) => Promise<ServerInviteResponse | null>
  onUpdateServer: (
    request: UpdateServerRequest,
  ) => Promise<ServerResponse | null>
  onDeleteServer: () => Promise<void>
  onRevokeServerInvite: (inviteId: string) => void
  onLoadMoreServerJoinRequests: () => void
  onApproveServerJoinRequest: (requestId: string) => void
  onDeclineServerJoinRequest: (requestId: string) => void
  onUnbanServerMember: (memberId: string) => void
  onReloadServerRoles: () => Promise<readonly ServerRoleResponse[]>
  onReloadServerMembers: () => Promise<void>
  onOpenServerCoreTab: (tab: ServerCoreTab) => void
  onCloseSettings: () => void
  onRoleDraftDirtyChange: (isDirty: boolean) => void
  onCloseInviteDialog: () => void
  onCloseOwnershipTransfer: () => void
  onConfirmOwnershipTransfer: (member: ServerMemberDetailsResponse) => void
  onCloseCreateSpaceDialog: () => void
  onCloseEditSpaceDialog: () => void
  onCloseDeleteSpaceDialog: () => void
  onSetSpaceTitleDraft: (title: string) => void
  onSetSpaceDescriptionDraft: (description: string) => void
  onSubmitCreateSpace: () => void
  onSubmitEditSpace: () => void
  onDeleteSpace: (space: SpaceResponse, action: 'delete' | 'promote') => void
  onUpsertSpacePermissionOverride: (
    spaceId: string,
    request: UpsertSpacePermissionOverrideRequest,
  ) => Promise<SpacePermissionOverrideResponse | null>
  onDeleteSpacePermissionOverride: (
    spaceId: string,
    overrideId: string,
  ) => Promise<boolean>
  onCloseMemberContextMenu: () => void
  onCloseSpaceContextMenu: () => void
  onCloseVoiceParticipantContextMenu: () => void
}

export function ServerWorkspaceOverlays({
  accessToken,
  server,
  serverMembers,
  serverSpaces,
  spacePermissions,
  serverInvites,
  serverJoinRequests,
  serverJoinRequestTotalCount,
  serverJoinRequestError,
  hasMoreServerJoinRequests,
  friends,
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
  currentUserPermissionCodes,
  isInviteDialogOpen,
  isLoadingInviteDialog,
  inviteDialogLoadError,
  isLoadingGovernance,
  isLoadingMoreServerJoinRequests,
  isMutatingGovernance,
  isMutatingSpaces,
  pendingOwnershipTransfer,
  createSpaceDialog,
  editSpaceDialog,
  pendingDeleteSpace,
  spaceTitleDraft,
  spaceDescriptionDraft,
  memberContextMenu,
  spaceContextMenu,
  voiceParticipantContextMenu,
  memberContextItems,
  spaceContextItems,
  voiceParticipantContextItems,
  isSettingsOpen,
  serverCoreTab,
  serverRoles,
  serverPermissions,
  serverAuditLogs,
  serverBans,
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
  onOpenServerCoreTab,
  onCloseSettings,
  onRoleDraftDirtyChange,
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
  onDeleteSpacePermissionOverride,
  onCloseMemberContextMenu,
  onCloseSpaceContextMenu,
  onCloseVoiceParticipantContextMenu,
}: ServerWorkspaceOverlaysProps) {
  return (
    <>
      {memberContextMenu && (
        <ContextMenu
          x={memberContextMenu.x}
          y={memberContextMenu.y}
          items={memberContextItems}
          onClose={onCloseMemberContextMenu}
        />
      )}

      {spaceContextMenu && (
        <ContextMenu
          x={spaceContextMenu.x}
          y={spaceContextMenu.y}
          items={spaceContextItems}
          onClose={onCloseSpaceContextMenu}
        />
      )}

      {voiceParticipantContextMenu && (
        <ContextMenu
          x={voiceParticipantContextMenu.x}
          y={voiceParticipantContextMenu.y}
          items={voiceParticipantContextItems}
          autoFocus
          onClose={onCloseVoiceParticipantContextMenu}
        />
      )}

      {isSettingsOpen && (
        <ServerSettingsDialog
          accessToken={accessToken}
          server={server}
          serverTitle={server.title}
          serverCoreTab={serverCoreTab}
          spaces={serverSpaces}
          serverInvites={serverInvites}
          serverJoinRequests={serverJoinRequests}
          serverJoinRequestTotalCount={serverJoinRequestTotalCount}
          serverJoinRequestError={serverJoinRequestError}
          hasMoreServerJoinRequests={hasMoreServerJoinRequests}
          serverRoles={serverRoles}
          serverPermissions={serverPermissions}
          serverAuditLogs={serverAuditLogs}
          serverBans={serverBans}
          currentUserPermissionCodes={currentUserPermissionCodes}
          canInviteMembers={canInviteMembers}
          canViewInviteLog={canViewInviteLog}
          canViewInvites={canViewInvites}
          canManageJoinRequests={canManageJoinRequests}
          canManageBans={canManageBans}
          canManageInvites={canManageInvites}
          canManageRoles={canManageRoles}
          canManageServerProfile={canManageServerProfile}
          canManageServerSettings={canManageServerSettings}
          canDeleteServer={canDeleteServer}
          canManageReports={canManageReports}
          canViewAuditLog={canViewAuditLog}
          isLoadingGovernance={isLoadingGovernance}
          isLoadingMoreServerJoinRequests={
            isLoadingMoreServerJoinRequests
          }
          isMutatingGovernance={isMutatingGovernance}
          onOpenServerCoreTab={onOpenServerCoreTab}
          onCreateServerInvite={onCreateServerInvite}
          onUpdateServer={onUpdateServer}
          onDeleteServer={onDeleteServer}
          onRevokeServerInvite={onRevokeServerInvite}
          onLoadMoreServerJoinRequests={onLoadMoreServerJoinRequests}
          onApproveServerJoinRequest={onApproveServerJoinRequest}
          onDeclineServerJoinRequest={onDeclineServerJoinRequest}
          onUnbanServerMember={onUnbanServerMember}
          onReloadServerRoles={onReloadServerRoles}
          onReloadServerMembers={onReloadServerMembers}
          onRoleDraftDirtyChange={onRoleDraftDirtyChange}
          onCloseSettings={onCloseSettings}
        />
      )}

      <ServerWorkspaceDialogs
        server={server}
        serverMembers={serverMembers}
        serverRoles={serverRoles}
        serverSpaces={serverSpaces}
        spacePermissions={spacePermissions}
        serverInvites={serverInvites}
        friends={friends}
        canInviteMembers={canInviteMembers}
        isInviteDialogOpen={isInviteDialogOpen}
        isLoadingInviteDialog={isLoadingInviteDialog}
        inviteDialogLoadError={inviteDialogLoadError}
        isMutatingGovernance={isMutatingGovernance}
        isMutatingSpaces={isMutatingSpaces}
        pendingOwnershipTransfer={pendingOwnershipTransfer}
        createSpaceDialog={createSpaceDialog}
        editSpaceDialog={editSpaceDialog}
        pendingDeleteSpace={pendingDeleteSpace}
        spaceTitleDraft={spaceTitleDraft}
        spaceDescriptionDraft={spaceDescriptionDraft}
        onCreateServerInvite={onCreateServerInvite}
        onCloseInviteDialog={onCloseInviteDialog}
        onCloseOwnershipTransfer={onCloseOwnershipTransfer}
        onConfirmOwnershipTransfer={onConfirmOwnershipTransfer}
        onCloseCreateSpaceDialog={onCloseCreateSpaceDialog}
        onCloseEditSpaceDialog={onCloseEditSpaceDialog}
        onCloseDeleteSpaceDialog={onCloseDeleteSpaceDialog}
        onSetSpaceTitleDraft={onSetSpaceTitleDraft}
        onSetSpaceDescriptionDraft={onSetSpaceDescriptionDraft}
        onSubmitCreateSpace={onSubmitCreateSpace}
        onSubmitEditSpace={onSubmitEditSpace}
        onDeleteSpace={onDeleteSpace}
        onUpsertSpacePermissionOverride={onUpsertSpacePermissionOverride}
        onDeleteSpacePermissionOverride={onDeleteSpacePermissionOverride}
      />
    </>
  )
}
