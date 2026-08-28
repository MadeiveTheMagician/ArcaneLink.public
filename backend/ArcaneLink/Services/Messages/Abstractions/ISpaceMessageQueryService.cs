using ArcaneLink.DataBase.DTOs.Messages;

namespace ArcaneLink.Services.Messages.Abstractions;

public interface ISpaceMessageQueryService
{
    Task<IReadOnlyList<SpaceMessageResponse>?> GetMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        int limit = 100,
        DateTime? beforeCreatedAt = null,
        Guid? beforeId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SpaceMessageResponse>?> SearchMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        string query,
        Guid? senderUserId = null,
        Guid? spaceId = null,
        string? attachmentType = null,
        int limit = 30,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> GetMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken = default);
}
