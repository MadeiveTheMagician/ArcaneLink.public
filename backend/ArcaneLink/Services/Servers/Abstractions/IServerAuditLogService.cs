using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions
{
    public interface IServerAuditLogService
    {
        Task<IReadOnlyList<ServerAuditLogResponse>?> GetAuditLogsAsync(Guid currentUserId, Guid serverId, CancellationToken cancellationToken = default);
    }
}
