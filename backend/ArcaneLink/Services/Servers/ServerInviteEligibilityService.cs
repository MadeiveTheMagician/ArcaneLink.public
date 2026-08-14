using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerInviteEligibilityService
    {
        private readonly AppDbContext _db;

        public ServerInviteEligibilityService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<bool> CanCreateDirectInviteToTargetAsync(
            Guid currentUserId,
            Guid serverId,
            Guid targetUserId,
            CancellationToken cancellationToken = default)
        {
            if (targetUserId == currentUserId ||
                await IsActiveServerMemberAsync(targetUserId, serverId, cancellationToken) ||
                await IsBannedServerMemberAsync(targetUserId, serverId, cancellationToken))
            {
                return false;
            }

            var now = DateTime.UtcNow;
            var candidates = await LoadDirectInviteCandidates(
                    currentUserId,
                    serverId,
                    targetUserId)
                .ToListAsync(cancellationToken);
            return candidates.All(invite => !ServerInviteRules.IsActive(invite, now));
        }

        public async Task<bool> IsActiveServerMemberAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return await _db.ServerMembers.AnyAsync(
                x => x.ServerId == serverId &&
                     x.UserId == userId &&
                     x.StatusId == ServerMemberStatusIds.Active &&
                     x.Server.DeletedAt == null,
                cancellationToken);
        }

        public async Task<bool> IsBannedServerMemberAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return await _db.ServerMembers.AnyAsync(
                x => x.ServerId == serverId &&
                     x.UserId == userId &&
                     x.StatusId == ServerMemberStatusIds.Banned &&
                     x.Server.DeletedAt == null,
                cancellationToken);
        }

        public async Task<ServerInviteResponse?> LoadActiveDirectInviteAsync(
            Guid currentUserId,
            Guid serverId,
            Guid? targetUserId,
            DateTime now,
            CancellationToken cancellationToken = default)
        {
            if (targetUserId == null)
            {
                return null;
            }

            var invite = (await LoadDirectInviteCandidates(
                    currentUserId,
                    serverId,
                    targetUserId.Value)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken))
                .FirstOrDefault(candidate => ServerInviteRules.IsActive(candidate, now));

            return invite == null
                ? null
                : ServerGovernanceMapper.ToInviteResponse(invite, now);
        }

        private IQueryable<ServerInvite> LoadDirectInviteCandidates(
            Guid currentUserId,
            Guid serverId,
            Guid targetUserId)
        {
            return _db.ServerInvites
                .AsNoTracking()
                .Include(x => x.Kind)
                .Include(x => x.Server)
                .Where(
                    x => x.ServerId == serverId &&
                         x.CreatedByUserId == currentUserId &&
                         x.TargetUserId == targetUserId &&
                         x.KindId == ServerGovernanceIds.InviteKindDirect &&
                         x.RevokedAt == null);
        }
    }
}
