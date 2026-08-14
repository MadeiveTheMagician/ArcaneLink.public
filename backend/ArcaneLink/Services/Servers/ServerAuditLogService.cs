using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerAuditLogService : IServerAuditLogService
    {
        private readonly AppDbContext _db;
        private readonly IServerGovernanceAccessService _access;

        public ServerAuditLogService(
            AppDbContext db,
            IServerGovernanceAccessService access)
        {
            _db = db;
            _access = access;
        }

        public async Task<IReadOnlyList<ServerAuditLogResponse>?> GetAuditLogsAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            if (!await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "VIEW_AUDIT_LOG",
                    cancellationToken))
            {
                return null;
            }

            return await _db.ServerAuditLogs
                .AsNoTracking()
                .Include(x => x.EventType)
                .Where(x => x.ServerId == serverId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(100)
                .Select(x => new ServerAuditLogResponse
                {
                    Id = x.Id,
                    ServerId = x.ServerId,
                    EventTypeCode = x.EventType.Code,
                    EventTitle = x.EventType.Title,
                    ActorUserId = x.ActorUserId,
                    TargetUserId = x.TargetUserId,
                    RelatedRoleId = x.RelatedRoleId,
                    RelatedInviteId = x.RelatedInviteId,
                    RelatedSpaceId = x.RelatedSpaceId,
                    Payload = x.Payload,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);
        }
    }
}
