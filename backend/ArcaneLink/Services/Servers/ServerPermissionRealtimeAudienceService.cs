using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers;

/// <summary>
/// Resolves realtime recipients from the same exact granular permissions
/// that protect the corresponding REST operation. This prevents a
/// server-wide SignalR group from learning about restricted governance
/// resources through invalidation events.
/// </summary>
public sealed class ServerPermissionRealtimeAudienceService
{
    private readonly AppDbContext _db;
    private readonly IServerGovernanceAccessService _access;

    public ServerPermissionRealtimeAudienceService(
        AppDbContext db,
        IServerGovernanceAccessService access)
    {
        this._db = db;
        this._access = access;
    }

    public async Task<IReadOnlyList<Guid>> ResolveAsync(
        Guid serverId,
        IReadOnlyCollection<string> anyPermissionCodes,
        IEnumerable<Guid>? explicitlyIncludedUserIds = null,
        IEnumerable<Guid>? excludedUserIds = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(anyPermissionCodes);

        var activeUserIds = await this._db.ServerMembers
            .AsNoTracking()
            .Where(member =>
                member.ServerId == serverId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.BannedAt == null &&
                member.Server.DeletedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active)
            .Select(member => member.UserId)
            .Distinct()
            .OrderBy(userId => userId)
            .ToListAsync(cancellationToken);

        var excluded = excludedUserIds?.ToHashSet() ?? [];
        var explicitlyIncluded = explicitlyIncludedUserIds?.ToHashSet() ?? [];
        var result = new List<Guid>(activeUserIds.Count);

        foreach (var userId in activeUserIds)
        {
            if (excluded.Contains(userId))
            {
                continue;
            }

            if (explicitlyIncluded.Contains(userId))
            {
                result.Add(userId);
                continue;
            }

            foreach (var permissionCode in anyPermissionCodes)
            {
                if (await this._access.HasGranularPermissionAsync(
                        userId,
                        serverId,
                        permissionCode,
                        cancellationToken))
                {
                    result.Add(userId);
                    break;
                }
            }
        }

        return result;
    }
}
