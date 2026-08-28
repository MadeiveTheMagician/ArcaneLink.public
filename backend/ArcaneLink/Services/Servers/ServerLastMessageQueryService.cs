using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers;

public class ServerLastMessageQueryService
{
    private readonly AppDbContext _db;
    private readonly SpaceMessageAccessService _messageAccess;

    public ServerLastMessageQueryService(
        AppDbContext db,
        SpaceMessageAccessService messageAccess)
    {
        this._db = db;
        this._messageAccess = messageAccess;
    }

    public async Task<Dictionary<Guid, ServerLastMessageResponse>> GetAsync(
        Guid currentUserId,
        IEnumerable<Guid> serverIds,
        IReadOnlyDictionary<Guid, SpaceAuthorizationSnapshot> snapshots,
        CancellationToken cancellationToken = default)
    {
        var serverIdSet = serverIds.ToHashSet();

        if (serverIdSet.Count == 0)
        {
            return [];
        }

        var allowedSpaceIds = serverIdSet
            .Where(snapshots.ContainsKey)
            .SelectMany(serverId =>
                snapshots[serverId].GetAllowedSpaceIds(SpaceAction.View))
            .ToList();

        if (allowedSpaceIds.Count == 0)
        {
            return [];
        }

        var readableMessageSpaceIds = new HashSet<Guid>();
        foreach (var serverId in serverIdSet)
        {
            var readable = await this._messageAccess.GetReadableMessageSpaceIdsAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (readable != null)
            {
                readableMessageSpaceIds.UnionWith(readable);
            }
        }
        if (readableMessageSpaceIds.Count == 0)
        {
            return [];
        }

        var messages = await this._db.SpaceMessages
            .AsNoTracking()
            .Where(message =>
                readableMessageSpaceIds.Contains(message.SpaceId) &&
                allowedSpaceIds.Contains(
                    message.Space.ParentVoiceSpaceId ?? message.SpaceId) &&
                message.DeletedAt == null &&
                message.Space.ServerId != null &&
                serverIdSet.Contains(message.Space.ServerId.Value) &&
                message.Space.DeletedAt == null)
            .GroupBy(message => message.Space.ServerId!.Value)
            .Select(group => group
                .OrderByDescending(message => message.CreatedAt)
                .ThenByDescending(message => message.Id)
                .Select(message => new ServerLastMessageRow(
                    message.Space.ServerId!.Value,
                    message.Space.ParentVoiceSpaceId ?? message.SpaceId,
                    message.Space.ParentVoiceSpace != null
                        ? message.Space.ParentVoiceSpace.Title
                        : message.Space.Title,
                    message.Body,
                    message.CreatedAt))
                .First())
            .ToListAsync(cancellationToken);

        return messages
            .ToDictionary(
                message => message.ServerId,
                message => new ServerLastMessageResponse
                {
                    SpaceId = message.SpaceId,
                    SpaceTitle = message.SpaceTitle,
                    Body = message.Body,
                    CreatedAt = message.CreatedAt
                });
    }

    private sealed record ServerLastMessageRow(
        Guid ServerId,
        Guid SpaceId,
        string SpaceTitle,
        string? Body,
        DateTime CreatedAt);
}
