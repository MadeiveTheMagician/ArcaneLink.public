using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;

namespace ArcaneLink.Services.Servers
{
    public class ServerGovernanceService : IServerGovernanceService
    {
        private readonly IServerInviteService _invites;
        private readonly IServerInviteQueryService _inviteQueries;
        private readonly IServerInviteAcceptanceService _inviteAcceptance;
        private readonly IServerOwnershipService _ownership;
        private readonly IServerRoleService _roles;
        private readonly IServerAuditLogService _auditLogs;

        public ServerGovernanceService(
            IServerInviteService invites,
            IServerInviteQueryService inviteQueries,
            IServerInviteAcceptanceService inviteAcceptance,
            IServerOwnershipService ownership,
            IServerRoleService roles,
            IServerAuditLogService auditLogs)
        {
            this._invites = invites;
            this._inviteQueries = inviteQueries;
            this._inviteAcceptance = inviteAcceptance;
            this._ownership = ownership;
            this._roles = roles;
            this._auditLogs = auditLogs;
        }

        public Task<IReadOnlyList<ServerInviteResponse>?> GetInvitesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return this._inviteQueries.GetInvitesAsync(currentUserId, serverId, cancellationToken);
        }

        public Task<ServerInvitePreviewResponse?> GetInvitePreviewAsync(
            string code,
            Guid? viewerUserId,
            CancellationToken cancellationToken = default)
        {
            return this._inviteQueries.GetInvitePreviewAsync(
                code,
                viewerUserId,
                cancellationToken);
        }

        public Task<IReadOnlyList<ServerInviteResponse>> GetMyDirectInvitesAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            return this._inviteQueries.GetMyDirectInvitesAsync(currentUserId, cancellationToken);
        }

        public Task<IReadOnlyList<ServerMemberResponse>> GetMyInviteTargetServersAsync(
            Guid currentUserId,
            Guid? targetUserId = null,
            CancellationToken cancellationToken = default)
        {
            return this._inviteQueries.GetMyInviteTargetServersAsync(currentUserId, targetUserId, cancellationToken);
        }

        public Task<ServerInviteResponse?> CreateInviteAsync(
            Guid currentUserId,
            Guid serverId,
            CreateServerInviteRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._invites.CreateInviteAsync(currentUserId, serverId, request, cancellationToken);
        }

        public Task<bool> RevokeInviteAsync(
            Guid currentUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return this._invites.RevokeInviteAsync(currentUserId, serverId, inviteId, cancellationToken);
        }

        public Task<ServerMemberResponse?> AcceptInviteAsync(
            Guid currentUserId,
            AcceptServerInviteRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._inviteAcceptance.AcceptInviteAsync(currentUserId, request, cancellationToken);
        }

        public Task<ServerMemberResponse?> AcceptInviteAsync(
            Guid currentUserId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return this._inviteAcceptance.AcceptInviteAsync(currentUserId, inviteId, cancellationToken);
        }

        public Task<bool> DeclineInviteAsync(
            Guid currentUserId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            return this._inviteAcceptance.DeclineInviteAsync(
                currentUserId,
                inviteId,
                cancellationToken);
        }

        public Task<ServerOwnershipTransferResponse?> TransferOwnershipAsync(
            Guid currentUserId,
            Guid serverId,
            TransferServerOwnershipRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._ownership.TransferOwnershipAsync(currentUserId, serverId, request, cancellationToken);
        }

        public Task<IReadOnlyList<PermissionResponse>> GetPermissionsAsync(
            CancellationToken cancellationToken = default)
        {
            return this._roles.GetPermissionsAsync(cancellationToken);
        }

        public Task<ServerPermissionCatalogResponse> GetPermissionCatalogV1Async(
            CancellationToken cancellationToken = default)
        {
            return this._roles.GetPermissionCatalogV1Async(cancellationToken);
        }

        public Task<IReadOnlyList<PermissionResponse>> GetSpacePermissionsAsync(
            CancellationToken cancellationToken = default)
        {
            return this._roles.GetSpacePermissionsAsync(cancellationToken);
        }

        public Task<IReadOnlyList<ServerRoleResponse>?> GetRolesAsync(
            Guid currentUserId,
            Guid serverId,
            ServerRoleQueryRequest query,
            CancellationToken cancellationToken = default)
        {
            return this._roles.GetRolesAsync(
                currentUserId,
                serverId,
                query,
                cancellationToken);
        }

        public Task<CreateServerRoleResult> CreateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            CreateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.CreateRoleAsync(currentUserId, serverId, request, cancellationToken);
        }

        public Task<UpdateServerRoleResult> UpdateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            UpdateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.UpdateRoleAsync(
                currentUserId,
                serverId,
                roleId,
                request,
                cancellationToken);
        }

        public Task<UpdateServerRoleResult> UpdateRolePermissionsAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            UpdateServerRolePermissionsRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.UpdateRolePermissionsAsync(currentUserId, serverId, roleId, request, cancellationToken);
        }

        public Task<DuplicateServerRoleResult> DuplicateRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            DuplicateServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.DuplicateRoleAsync(
                currentUserId,
                serverId,
                roleId,
                request,
                cancellationToken);
        }

        public Task<ServerRoleDeletionImpactResponse?> GetRoleDeletionImpactAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            CancellationToken cancellationToken = default)
        {
            return this._roles.GetDeletionImpactAsync(
                currentUserId,
                serverId,
                roleId,
                cancellationToken);
        }

        public Task<DeleteServerRoleResult> DeleteRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid roleId,
            Guid expectedVersion,
            CancellationToken cancellationToken = default)
        {
            return this._roles.DeleteRoleAsync(
                currentUserId,
                serverId,
                roleId,
                expectedVersion,
                cancellationToken);
        }

        public Task<ReorderServerRolesResult> ReorderRolesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderServerRolesRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.ReorderRolesAsync(
                currentUserId,
                serverId,
                request,
                cancellationToken);
        }

        public Task<ServerMemberRoleResponse?> AssignRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberId,
            AssignServerRoleRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._roles.AssignRoleAsync(currentUserId, serverId, memberId, request, cancellationToken);
        }

        public Task<bool> RevokeMemberRoleAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberRoleId,
            CancellationToken cancellationToken = default)
        {
            return this._roles.RevokeMemberRoleAsync(currentUserId, serverId, memberRoleId, cancellationToken);
        }

        public Task<IReadOnlyList<ServerAuditLogResponse>?> GetAuditLogsAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return this._auditLogs.GetAuditLogsAsync(currentUserId, serverId, cancellationToken);
        }
    }
}
