using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages;

public sealed class UnreadCountService
{
    private readonly AppDbContext _db;
    private readonly ISpaceAuthorizationService _authorization;
    private readonly SpaceMessageAccessService _messageAccess;

    public UnreadCountService(
        AppDbContext db,
        ISpaceAuthorizationService authorization,
        SpaceMessageAccessService messageAccess)
    {
        this._db = db;
        this._authorization = authorization;
        this._messageAccess = messageAccess;
    }

    public async Task<Dictionary<Guid, long>> GetServerSpaceUnreadCountsAsync(
        Guid currentUserId,
        Guid serverId,
        IEnumerable<Guid> visibleTextSpaceIds,
        CancellationToken cancellationToken = default)
    {
        var spaceIds = visibleTextSpaceIds.Distinct().ToList();
        if (spaceIds.Count == 0)
        {
            return [];
        }

        var readableSpaceIds = await this._messageAccess.GetReadableMessageSpaceIdsAsync(
            currentUserId,
            serverId,
            cancellationToken);
        if (readableSpaceIds == null || readableSpaceIds.Count == 0)
        {
            return [];
        }

        var joinedAt = await this._db.ServerMembers
            .AsNoTracking()
            .Where(x =>
                x.ServerId == serverId &&
                x.UserId == currentUserId &&
                x.StatusId == ServerMemberStatusIds.Active &&
                x.BannedAt == null)
            .Select(x => (DateTime?)x.JoinedAt)
            .SingleOrDefaultAsync(cancellationToken);
        if (!joinedAt.HasValue)
        {
            return [];
        }

        var messageSpaces = await this._db.Spaces
            .AsNoTracking()
            .Where(space =>
                space.ServerId == serverId &&
                (spaceIds.Contains(space.Id) ||
                 space.ParentVoiceSpaceId.HasValue &&
                 spaceIds.Contains(space.ParentVoiceSpaceId.Value)) &&
                (space.TypeId == SpaceIds.TypeTextRoom ||
                 space.TypeId == SpaceIds.TypeVoiceRoom) &&
                space.DeletedAt == null)
            .Select(space => new MessageSpaceRow(
                space.Id,
                space.ParentVoiceSpaceId ?? space.Id))
            .ToListAsync(cancellationToken);
        messageSpaces = messageSpaces
            .Where(space => readableSpaceIds.Contains(space.MessageSpaceId))
            .ToList();
        var messageSpaceIds = messageSpaces
            .Select(space => space.MessageSpaceId)
            .ToList();

        var eligibleMessages = this._db.SpaceMessages
            .AsNoTracking()
            .Where(x =>
                messageSpaceIds.Contains(x.SpaceId) &&
                x.Space.ServerId == serverId &&
                (x.Space.TypeId == SpaceIds.TypeTextRoom ||
                 x.Space.TypeId == SpaceIds.TypeVoiceRoom) &&
                x.Space.DeletedAt == null &&
                x.DeletedAt == null &&
                x.SenderUserId != currentUserId &&
                x.CreatedAt >= joinedAt.Value);

        var counts = await this.CountUnreadAsync(
            currentUserId,
            eligibleMessages,
            messageSpaceIds,
            cancellationToken);
        var visibleSpaceIdByMessageSpaceId = messageSpaces.ToDictionary(
            space => space.MessageSpaceId,
            space => space.VisibleSpaceId);
        return counts
            .GroupBy(count => visibleSpaceIdByMessageSpaceId[count.Key])
            .ToDictionary(
                group => group.Key,
                group => group.Sum(count => count.Value));
    }

    public async Task<Dictionary<Guid, long>> GetServerUnreadCountsAsync(
        Guid currentUserId,
        IEnumerable<Guid> serverIds,
        IReadOnlyDictionary<Guid, SpaceAuthorizationSnapshot> snapshots,
        CancellationToken cancellationToken = default)
    {
        var distinctServerIds = serverIds.Distinct().ToList();

        var messageSpaces = await this._db.Spaces
            .AsNoTracking()
            .Where(x =>
                x.ServerId.HasValue &&
                distinctServerIds.Contains(x.ServerId.Value) &&
                (x.TypeId == SpaceIds.TypeTextRoom ||
                 x.TypeId == SpaceIds.TypeVoiceRoom) &&
                x.DeletedAt == null)
            .Select(x => new ServerSpaceRow(
                x.Id,
                x.ServerId!.Value,
                x.ParentVoiceSpaceId ?? x.Id))
            .ToListAsync(cancellationToken);
        var visibleSpaces = messageSpaces
            .Where(space =>
                snapshots.TryGetValue(space.ServerId, out var snapshot) &&
                snapshot.Can(space.AuthorizationSpaceId, SpaceAction.View))
            .ToList();
        var readableSpaceIdsByServer = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var serverId in distinctServerIds)
        {
            var readableSpaceIds = await this._messageAccess
                .GetReadableMessageSpaceIdsAsync(
                    currentUserId,
                    serverId,
                    cancellationToken);
            readableSpaceIdsByServer[serverId] =
                readableSpaceIds?.ToHashSet() ?? [];
        }
        visibleSpaces = visibleSpaces
            .Where(space =>
                readableSpaceIdsByServer
                    .GetValueOrDefault(space.ServerId)?
                    .Contains(space.SpaceId) == true)
            .ToList();
        var visibleSpaceIds = visibleSpaces.Select(x => x.SpaceId).ToList();

        var eligibleMessages = this._db.SpaceMessages
            .AsNoTracking()
            .Where(message =>
                visibleSpaceIds.Contains(message.SpaceId) &&
                message.DeletedAt == null &&
                message.SenderUserId != currentUserId &&
                message.Space.ServerId.HasValue &&
                this._db.ServerMembers.Any(member =>
                    member.ServerId == message.Space.ServerId.Value &&
                    member.UserId == currentUserId &&
                    member.StatusId == ServerMemberStatusIds.Active &&
                    member.BannedAt == null &&
                    message.CreatedAt >= member.JoinedAt));
        var counts = await this.CountUnreadAsync(
            currentUserId,
            eligibleMessages,
            visibleSpaceIds,
            cancellationToken);

        var serverIdBySpaceId = visibleSpaces.ToDictionary(
            x => x.SpaceId,
            x => x.ServerId);
        var result = distinctServerIds.ToDictionary(id => id, _ => 0L);
        foreach (var count in counts)
        {
            if (serverIdBySpaceId.TryGetValue(count.Key, out var serverId))
            {
                result[serverId] += count.Value;
            }
        }

        return result;
    }

    public async Task<Dictionary<Guid, long>> GetPrivateSpaceUnreadCountsAsync(
        Guid currentUserId,
        IEnumerable<Guid> spaceIds,
        CancellationToken cancellationToken = default)
    {
        var distinctSpaceIds = spaceIds.Distinct().ToList();
        if (distinctSpaceIds.Count == 0)
        {
            return [];
        }

        var eligibleMessages = this._db.SpaceMessages
            .AsNoTracking()
            .Where(message =>
                distinctSpaceIds.Contains(message.SpaceId) &&
                message.Space.ServerId == null &&
                message.Space.DeletedAt == null &&
                message.DeletedAt == null &&
                !message.UserDeletions.Any(deletion => deletion.UserId == currentUserId) &&
                message.SenderUserId != currentUserId &&
                this._db.PrivateSpaceMembers.Any(member =>
                    member.SpaceId == message.SpaceId &&
                    member.UserId == currentUserId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    message.CreatedAt >= member.JoinedAt &&
                    (!member.HistoryClearedAt.HasValue ||
                     message.CreatedAt > member.HistoryClearedAt.Value)));

        return await this.CountUnreadAsync(
            currentUserId,
            eligibleMessages,
            distinctSpaceIds,
            cancellationToken);
    }

    private async Task<Dictionary<Guid, long>> CountUnreadAsync(
        Guid currentUserId,
        IQueryable<SpaceMessage> eligibleMessages,
        IReadOnlyCollection<Guid> eligibleSpaceIds,
        CancellationToken cancellationToken)
    {
        var laterCounts = await eligibleMessages
            .Where(message =>
                !this._db.SpaceReadStates.Any(state =>
                    state.UserId == currentUserId &&
                    state.SpaceId == message.SpaceId &&
                    state.LastReadMessageCreatedAt.HasValue) ||
                this._db.SpaceReadStates.Any(state =>
                    state.UserId == currentUserId &&
                    state.SpaceId == message.SpaceId &&
                    state.LastReadMessageCreatedAt < message.CreatedAt))
            .GroupBy(message => message.SpaceId)
            .Select(group => new UnreadCountRow(
                group.Key,
                group.LongCount()))
            .ToListAsync(cancellationToken);

        var markers = await this._db.SpaceReadStates
            .AsNoTracking()
            .Where(state =>
                state.UserId == currentUserId &&
                eligibleSpaceIds.Contains(state.SpaceId) &&
                state.LastReadMessageCreatedAt.HasValue)
            .Select(state => new ReadMarkerRow(
                state.SpaceId,
                state.LastReadMessageId,
                state.LastReadMessageCreatedAt!.Value))
            .ToDictionaryAsync(x => x.SpaceId, cancellationToken);

        var equalTimeMessages = await eligibleMessages
            .Where(message => this._db.SpaceReadStates.Any(state =>
                state.UserId == currentUserId &&
                state.SpaceId == message.SpaceId &&
                state.LastReadMessageCreatedAt == message.CreatedAt))
            .Select(message => new EqualTimeMessageRow(
                message.SpaceId,
                message.Id))
            .ToListAsync(cancellationToken);

        var result = laterCounts.ToDictionary(x => x.SpaceId, x => x.Count);
        foreach (var message in equalTimeMessages)
        {
            if (!markers.TryGetValue(message.SpaceId, out var marker) ||
                !marker.MessageId.HasValue ||
                message.MessageId.CompareTo(marker.MessageId.Value) > 0)
            {
                result[message.SpaceId] = result.GetValueOrDefault(message.SpaceId) + 1;
            }
        }

        return result;
    }

    private sealed record UnreadCountRow(Guid SpaceId, long Count);
    private sealed record ReadMarkerRow(
        Guid SpaceId,
        Guid? MessageId,
        DateTime CreatedAt);
    private sealed record EqualTimeMessageRow(Guid SpaceId, Guid MessageId);
    private sealed record MessageSpaceRow(
        Guid MessageSpaceId,
        Guid VisibleSpaceId);
    private sealed record ServerSpaceRow(
        Guid SpaceId,
        Guid ServerId,
        Guid AuthorizationSpaceId);
}
