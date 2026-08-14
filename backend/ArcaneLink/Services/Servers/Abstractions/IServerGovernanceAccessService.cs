using ArcaneLink.DataBase.Models.ServersModels;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerGovernanceAccessService
    {
        Task<bool> CanManageServerAsync(Guid userId, Guid serverId, CancellationToken cancellationToken);
        Task<bool> CanCreateInvitesAsync(Guid userId, Guid serverId, CancellationToken cancellationToken);
        Task<bool> HasEffectiveServerPermissionAsync(Guid userId, Guid serverId, Guid permissionId, CancellationToken cancellationToken);
        Task<bool> HasServerPermissionAsync(Guid userId, Guid serverId, Guid permissionId, CancellationToken cancellationToken);
        Task<bool> HasGranularPermissionAsync(
            Guid userId,
            Guid serverId,
            string permissionCode,
            CancellationToken cancellationToken,
            bool ownerOnly = false,
            IReadOnlyList<string>? dependencyCodes = null);
        Task<ServerRole?> EnsureOwnerRoleAsync(Guid serverId, CancellationToken cancellationToken);
        Task<bool> IsActiveMemberAsync(Guid userId, Guid serverId, CancellationToken cancellationToken);
        void AddAudit(Guid serverId, Guid eventTypeId, Guid? actorUserId = null, Guid? targetUserId = null, Guid? relatedRoleId = null, Guid? relatedInviteId = null, Guid? relatedSpaceId = null, string? payload = null);
    }
}
