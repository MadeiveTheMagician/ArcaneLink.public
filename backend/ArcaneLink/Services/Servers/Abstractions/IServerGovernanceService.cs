using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerGovernanceService
    {
        Task<IReadOnlyList<ServerInviteResponse>?> GetInvitesAsync(Guid currentUserId, Guid serverId, CancellationToken cancellationToken = default);
        Task<ServerInvitePreviewResponse?> GetInvitePreviewAsync(string code, Guid? viewerUserId, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ServerInviteResponse>> GetMyDirectInvitesAsync(Guid currentUserId, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ServerMemberResponse>> GetMyInviteTargetServersAsync(Guid currentUserId, Guid? targetUserId = null, CancellationToken cancellationToken = default);
        Task<ServerInviteResponse?> CreateInviteAsync(Guid currentUserId, Guid serverId, CreateServerInviteRequest request, CancellationToken cancellationToken = default);
        Task<bool> RevokeInviteAsync(Guid currentUserId, Guid serverId, Guid inviteId, CancellationToken cancellationToken = default);
        Task<ServerMemberResponse?> AcceptInviteAsync(Guid currentUserId, AcceptServerInviteRequest request, CancellationToken cancellationToken = default);
        Task<ServerMemberResponse?> AcceptInviteAsync(Guid currentUserId, Guid inviteId, CancellationToken cancellationToken = default);
        Task<bool> DeclineInviteAsync(Guid currentUserId, Guid inviteId, CancellationToken cancellationToken = default);

        Task<ServerOwnershipTransferResponse?> TransferOwnershipAsync(Guid currentUserId, Guid serverId, TransferServerOwnershipRequest request, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<PermissionResponse>> GetPermissionsAsync(CancellationToken cancellationToken = default);
        Task<ServerPermissionCatalogResponse> GetPermissionCatalogV1Async(CancellationToken cancellationToken = default);
        Task<IReadOnlyList<PermissionResponse>> GetSpacePermissionsAsync(CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ServerRoleResponse>?> GetRolesAsync(Guid currentUserId, Guid serverId, ServerRoleQueryRequest query, CancellationToken cancellationToken = default);
        Task<CreateServerRoleResult> CreateRoleAsync(Guid currentUserId, Guid serverId, CreateServerRoleRequest request, CancellationToken cancellationToken = default);
        Task<UpdateServerRoleResult> UpdateRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, UpdateServerRoleRequest request, CancellationToken cancellationToken = default);
        Task<UpdateServerRoleResult> UpdateRolePermissionsAsync(Guid currentUserId, Guid serverId, Guid roleId, UpdateServerRolePermissionsRequest request, CancellationToken cancellationToken = default);
        Task<DuplicateServerRoleResult> DuplicateRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, DuplicateServerRoleRequest request, CancellationToken cancellationToken = default);
        Task<ServerRoleDeletionImpactResponse?> GetRoleDeletionImpactAsync(Guid currentUserId, Guid serverId, Guid roleId, CancellationToken cancellationToken = default);
        Task<DeleteServerRoleResult> DeleteRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, Guid expectedVersion, CancellationToken cancellationToken = default);
        Task<ReorderServerRolesResult> ReorderRolesAsync(Guid currentUserId, Guid serverId, ReorderServerRolesRequest request, CancellationToken cancellationToken = default);
        Task<ServerMemberRoleResponse?> AssignRoleAsync(Guid currentUserId, Guid serverId, Guid memberId, AssignServerRoleRequest request, CancellationToken cancellationToken = default);
        Task<bool> RevokeMemberRoleAsync(Guid currentUserId, Guid serverId, Guid memberRoleId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ServerAuditLogResponse>?> GetAuditLogsAsync(Guid currentUserId, Guid serverId, CancellationToken cancellationToken = default);
    }
}
