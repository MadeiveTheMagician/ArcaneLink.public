using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerInviteQueryService : IServerInviteQueryService
    {
        private readonly AppDbContext _db;
        private readonly IServerGovernanceAccessService _access;
        private readonly ServerInviteEligibilityService _eligibility;
        private readonly IUserPresencePolicyService _presencePolicy;

        public ServerInviteQueryService(
            AppDbContext db,
            IServerGovernanceAccessService access,
            ServerInviteEligibilityService eligibility,
            IUserPresencePolicyService presencePolicy)
        {
            this._db = db;
            this._access = access;
            this._eligibility = eligibility;
            this._presencePolicy = presencePolicy;
        }

        public async Task<IReadOnlyList<ServerInviteResponse>?> GetInvitesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var canCreateInvites = await this._access.CanCreateInvitesAsync(
                currentUserId,
                serverId,
                cancellationToken);
            var canViewInviteLog = await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "VIEW_INVITE_LOG",
                cancellationToken);
            var canManageInvites = await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "MANAGE_INVITES",
                cancellationToken);
            if (!canCreateInvites && !canViewInviteLog && !canManageInvites)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var invites = await this._db.ServerInvites
                .AsNoTracking()
                .Include(x => x.Kind)
                .Include(x => x.Server)
                .Where(x =>
                    x.ServerId == serverId &&
                    (canViewInviteLog ||
                     canManageInvites ||
                     x.CreatedByUserId == currentUserId))
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return invites
                .Select(x => ServerGovernanceMapper.ToInviteResponse(x, now))
                .ToList();
        }

        public async Task<ServerInvitePreviewResponse?> GetInvitePreviewAsync(
            string code,
            Guid? viewerUserId,
            CancellationToken cancellationToken = default)
        {
            var normalizedCode = ServerInviteRules.NormalizeCode(code);
            if (string.IsNullOrWhiteSpace(normalizedCode))
            {
                return null;
            }

            var invite = await this._db.ServerInvites
                .AsNoTracking()
                .Include(x => x.Server)
                .FirstOrDefaultAsync(
                    x => x.Code == normalizedCode &&
                         x.KindId == ServerGovernanceIds.InviteKindLink,
                    cancellationToken);

            if (invite == null)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var isServerDeleted = invite.Server.DeletedAt != null;
            var isExpired = invite.ExpiresAt != null && invite.ExpiresAt <= now;
            var isMaxedOut = invite.MaxUses != null && invite.UsedCount >= invite.MaxUses;
            var isRevoked = invite.RevokedAt != null;
            var isActive = !isServerDeleted && !isRevoked && !isExpired && !isMaxedOut;
            var memberCount = isServerDeleted
                ? 0
                : await this._db.ServerMembers.CountAsync(
                    x => x.ServerId == invite.ServerId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.BannedAt == null,
                    cancellationToken);
            var onlineCounts = isServerDeleted
                ? []
                : await this.GetOnlineMemberCountsAsync(
                    viewerUserId,
                    [invite.ServerId],
                    cancellationToken);
            var onlineCount = onlineCounts.GetValueOrDefault(invite.ServerId);

            return new ServerInvitePreviewResponse
            {
                Code = normalizedCode,
                IsActive = isActive,
                InvalidReason = isActive
                    ? null
                    : isServerDeleted
                        ? "server_deleted"
                        : isRevoked
                            ? "revoked"
                            : isExpired
                                ? "expired"
                                : isMaxedOut
                                    ? "max_uses_reached"
                                    : "invalid",
                ServerId = isServerDeleted ? null : invite.ServerId,
                ServerTitle = isServerDeleted ? null : invite.Server.Title,
                ServerIconAssetId = isServerDeleted ? null : invite.Server.IconAssetId,
                ServerIconCropOffsetX = invite.Server.IconCropOffsetX,
                ServerIconCropOffsetY = invite.Server.IconCropOffsetY,
                ServerIconCropZoom = invite.Server.IconCropZoom,
                MemberCount = memberCount,
                OnlineCount = onlineCount,
                MaxUses = invite.MaxUses,
                UsedCount = invite.UsedCount,
                ExpiresAt = invite.ExpiresAt
            };
        }

        public async Task<IReadOnlyList<ServerInviteResponse>> GetMyDirectInvitesAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var invites = await this._db.ServerInvites
                .AsNoTracking()
                .Include(x => x.Kind)
                .Include(x => x.Server)
                .Where(
                    x => x.KindId == ServerGovernanceIds.InviteKindDirect &&
                         x.TargetUserId == currentUserId &&
                         x.Server.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            var activeInvites = invites
                .Where(x => ServerInviteRules.IsActive(x, now))
                .ToList();
            var serverIds = activeInvites.Select(x => x.ServerId).Distinct().ToList();
            var memberCounts = await this._db.ServerMembers
                .Where(x =>
                    serverIds.Contains(x.ServerId) &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null)
                .GroupBy(x => x.ServerId)
                .Select(group => new { ServerId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(x => x.ServerId, x => x.Count, cancellationToken);
            var onlineCounts = await this.GetOnlineMemberCountsAsync(
                currentUserId,
                serverIds,
                cancellationToken);

            return activeInvites
                .Select(invite => ServerGovernanceMapper.ToInviteResponse(
                    invite,
                    now,
                    memberCounts.GetValueOrDefault(invite.ServerId),
                    onlineCounts.GetValueOrDefault(invite.ServerId)))
                .ToList();
        }

        public async Task<IReadOnlyList<ServerMemberResponse>> GetMyInviteTargetServersAsync(
            Guid currentUserId,
            Guid? targetUserId = null,
            CancellationToken cancellationToken = default)
        {
            var memberships = await this._db.ServerMembers
                .AsNoTracking()
                .Include(x => x.Status)
                .Include(x => x.Server)
                .Where(x => x.UserId == currentUserId &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null &&
                            x.Server.DeletedAt == null)
                .OrderBy(x => x.Server.Title)
                .ToListAsync(cancellationToken);
            var result = new List<ServerMemberResponse>();

            foreach (var membership in memberships)
            {
                if (!await this._access.CanCreateInvitesAsync(
                        currentUserId,
                        membership.ServerId,
                        cancellationToken))
                {
                    continue;
                }

                if (targetUserId.HasValue &&
                    !await this._eligibility.CanCreateDirectInviteToTargetAsync(
                        currentUserId,
                        membership.ServerId,
                        targetUserId.Value,
                        cancellationToken))
                {
                    continue;
                }

                result.Add(ServerGovernanceMapper.ToServerMemberResponse(membership));
            }

            return result;
        }

        private async Task<Dictionary<Guid, int>> GetOnlineMemberCountsAsync(
            Guid? viewerUserId,
            IReadOnlyCollection<Guid> serverIds,
            CancellationToken cancellationToken)
        {
            if (serverIds.Count == 0)
            {
                return [];
            }

            var activeMembers = await this._db.ServerMembers
                .AsNoTracking()
                .Where(member =>
                    serverIds.Contains(member.ServerId) &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null)
                .Select(member => new { member.ServerId, member.UserId })
                .ToListAsync(cancellationToken);
            var presence = await this._presencePolicy.ResolveAsync(
                viewerUserId,
                activeMembers.Select(member => member.UserId),
                cancellationToken);

            return activeMembers
                .Where(member =>
                    presence.GetValueOrDefault(
                        member.UserId,
                        UserPresenceSnapshot.Hidden).PresenceStatus ==
                    PresenceStatusCodes.Online)
                .GroupBy(member => member.ServerId)
                .ToDictionary(group => group.Key, group => group.Count());
        }
    }
}
