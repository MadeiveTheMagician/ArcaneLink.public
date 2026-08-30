using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Messages.Abstractions;
using ArcaneLink.Services.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages;

public class SpaceMessageQueryService : ISpaceMessageQueryService
{
    private readonly AppDbContext _db;
    private readonly SpaceMessageAccessService _access;

    public SpaceMessageQueryService(
        AppDbContext db,
        SpaceMessageAccessService access)
    {
        this._db = db;
        this._access = access;
    }

    public async Task<IReadOnlyList<SpaceMessageResponse>?> GetMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        int limit = 100,
        DateTime? beforeCreatedAt = null,
        Guid? beforeId = null,
        CancellationToken cancellationToken = default)
    {
        if (await this._access.GetReadableMessageSpaceAsync(
                currentUserId,
                serverId,
                spaceId,
                cancellationToken) == null)
        {
            return null;
        }

        var take = Math.Clamp(limit, 1, 100);
        var query = LoadMessagesQuery(this._db, serverId)
            .Where(x => x.SpaceId == spaceId && x.DeletedAt == null);

        if (beforeCreatedAt.HasValue && beforeId.HasValue)
        {
            var cursorCreatedAt = beforeCreatedAt.Value;
            var cursorId = beforeId.Value;
            query = query.Where(x =>
                x.CreatedAt < cursorCreatedAt ||
                (x.CreatedAt == cursorCreatedAt &&
                 x.Id.CompareTo(cursorId) < 0));
        }
        else if (beforeCreatedAt.HasValue)
        {
            query = query.Where(x => x.CreatedAt < beforeCreatedAt.Value);
        }

        var messages = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        return messages
            .OrderBy(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Select(message => SpaceMessageMapper.ToResponse(message, currentUserId))
            .ToList();
    }

    public async Task<IReadOnlyList<SpaceMessageResponse>?> SearchMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        string query,
        Guid? senderUserId = null,
        Guid? spaceId = null,
        string? attachmentType = null,
        int limit = 30,
        CancellationToken cancellationToken = default)
    {
        var spaceIds = await this._access.GetReadableMessageSpaceIdsAsync(
            currentUserId,
            serverId,
            cancellationToken);

        if (spaceIds == null)
        {
            return null;
        }

        var normalizedQuery = NormalizeSearchQuery(query);
        var normalizedAttachmentType = NormalizeSearchQuery(attachmentType ?? string.Empty);
        if (normalizedQuery == null &&
            senderUserId == null &&
            spaceId == null &&
            normalizedAttachmentType == null)
        {
            return [];
        }

        var take = Math.Clamp(limit, 1, 50);
        var messageQuery = LoadMessagesQuery(this._db, serverId)
            .Where(
                x => spaceIds.Contains(x.SpaceId) &&
                     x.DeletedAt == null);

        if (spaceId.HasValue)
        {
            if (!spaceIds.Contains(spaceId.Value))
            {
                return null;
            }

            messageQuery = messageQuery.Where(x => x.SpaceId == spaceId.Value);
        }

        if (senderUserId.HasValue)
        {
            messageQuery = messageQuery.Where(x => x.SenderUserId == senderUserId.Value);
        }

        if (normalizedQuery != null)
        {
            messageQuery = messageQuery.Where(
                x => x.Body != null && x.Body.ToLower().Contains(normalizedQuery));
        }

        messageQuery = ApplyAttachmentFilter(messageQuery, normalizedAttachmentType);

        var messages = await messageQuery
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        return messages
            .Select(message => SpaceMessageMapper.ToResponse(message, currentUserId))
            .ToList();
    }

    public async Task<SpaceMessageResponse?> GetMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default)
    {
        if (await this._access.GetReadableMessageSpaceAsync(
                currentUserId,
                serverId,
                spaceId,
                cancellationToken) == null)
        {
            return null;
        }

        var message = await LoadMessagesQuery(this._db, serverId)
            .FirstOrDefaultAsync(
                x => x.Id == messageId &&
                     x.SpaceId == spaceId &&
                     x.DeletedAt == null,
                cancellationToken);

        return message == null
            ? null
            : SpaceMessageMapper.ToResponse(message, currentUserId);
    }

    public async Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken = default)
    {
        if (await this._access.GetReadableMessageSpaceAsync(
                currentUserId,
                serverId,
                spaceId,
                cancellationToken) == null)
        {
            return null;
        }

        var pinnedMessageIds = await this._db.SpacePinnedMessages
            .AsNoTracking()
            .Where(x => x.SpaceId == spaceId && x.UnpinnedAt == null)
            .OrderByDescending(x => x.PinnedAt)
            .Select(x => x.MessageId)
            .ToListAsync(cancellationToken);

        var messagesById = await LoadMessagesQuery(this._db, serverId)
            .Where(x => pinnedMessageIds.Contains(x.Id))
            .Where(x => x.DeletedAt == null)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var messages = pinnedMessageIds
            .Select(id => messagesById.GetValueOrDefault(id))
            .Where(message => message != null)
            .Select(message => message!)
            .ToList();

        return messages
            .Select(message => SpaceMessageMapper.ToResponse(message, currentUserId))
            .ToList();
    }

    internal static async Task<SpaceMessageResponse?> LoadMutationResponseAsync(
        AppDbContext db,
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var message = await LoadMessagesQuery(db, serverId)
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.Id == messageId &&
                    candidate.SpaceId == spaceId &&
                    candidate.DeletedAt == null,
                cancellationToken);
        return message == null
            ? null
            : SpaceMessageMapper.ToResponse(message, currentUserId);
    }

    private static IQueryable<SpaceMessage> LoadMessagesQuery(
        AppDbContext db,
        Guid serverId)
    {
        return db.SpaceMessages
            .AsNoTracking()
            .AsSplitQuery()
            .Include(x => x.Space)
            .Include(x => x.MessageType)
            .Include(x => x.SenderUser)
                .ThenInclude(x => x.Profile)
            .Include(x => x.SenderUser)
                .ThenInclude(x => x.ServerMemberships
                    .Where(member => member.ServerId == serverId))
                .ThenInclude(x => x.ServerProfile)
            .Include(x => x.ReplyToMessage)
                .ThenInclude(x => x!.SenderUser)
                .ThenInclude(x => x.Profile)
            .Include(x => x.ReplyToMessage)
                .ThenInclude(x => x!.SenderUser)
                .ThenInclude(x => x.ServerMemberships
                    .Where(member => member.ServerId == serverId))
                .ThenInclude(x => x.ServerProfile)
            .Include(x => x.ReplyToMessage)
                .ThenInclude(x => x!.UserDeletions)
            .Include(x => x.Assets)
                .ThenInclude(x => x.Asset)
            .Include(x => x.Reactions)
            .Include(x => x.Mentions);
    }

    private static string? NormalizeSearchQuery(string query)
    {
        var trimmed = query.Trim();
        return trimmed.Length == 0 ? null : trimmed.ToLowerInvariant();
    }

    private static IQueryable<SpaceMessage> ApplyAttachmentFilter(
        IQueryable<SpaceMessage> query,
        string? attachmentType)
    {
        return attachmentType switch
        {
            null => query,
            "any" => query.Where(x => x.Assets.Any()),
            "image" => query.Where(x => x.Assets.Any(asset =>
                asset.Asset.MimeType.ToLower().StartsWith("image/"))),
            "video" => query.Where(x => x.Assets.Any(asset =>
                asset.Asset.MimeType.ToLower().StartsWith("video/"))),
            "audio" => query.Where(x => x.Assets.Any(asset =>
                asset.Asset.MimeType.ToLower().StartsWith("audio/"))),
            "file" => query.Where(x => x.Assets.Any(asset =>
                !asset.Asset.MimeType.ToLower().StartsWith("image/") &&
                !asset.Asset.MimeType.ToLower().StartsWith("video/") &&
                !asset.Asset.MimeType.ToLower().StartsWith("audio/"))),
            _ => query
        };
    }
}
