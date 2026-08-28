using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;

namespace ArcaneLink.Services.Messages.Abstractions;

public interface ISpaceMessageCommandService
{
    Task<SpaceMessageResponse?> CreateMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        CreateSpaceMessageRequest request,
        CancellationToken cancellationToken = default);

    Task<AssetResponse?> UploadAttachmentAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        IFormFile file,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> UpdateMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        UpdateSpaceMessageRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> PinMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task<bool> UnpinMessageAsync(
        Guid currentUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);
}
