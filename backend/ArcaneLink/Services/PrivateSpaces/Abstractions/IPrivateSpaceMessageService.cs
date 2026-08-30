using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;

namespace ArcaneLink.Services.PrivateSpaces.Abstractions;

public interface IPrivateSpaceMessageService
{
    Task<IReadOnlyList<SpaceMessageResponse>?> GetMessagesAsync(
        Guid currentUserId,
        Guid spaceId,
        int limit = 100,
        DateTime? beforeCreatedAt = null,
        Guid? beforeId = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SpaceMessageResponse>?> SearchMessagesAsync(
        Guid currentUserId,
        Guid spaceId,
        string query,
        Guid? senderUserId = null,
        string? attachmentType = null,
        int limit = 30,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
        Guid currentUserId,
        Guid spaceId,
        CancellationToken cancellationToken = default);

    Task<AssetResponse?> UploadAttachmentAsync(
        Guid currentUserId,
        Guid spaceId,
        IFormFile file,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> CreateMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        CreateSpaceMessageRequest request,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> UpdateMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid messageId,
        UpdateSpaceMessageRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid messageId,
        string scope,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PrivateSpaceTrashMessageResponse>?> GetTrashAsync(
        Guid currentUserId,
        Guid spaceId,
        int limit = 100,
        DateTime? beforeDeletedAt = null,
        Guid? beforeId = null,
        CancellationToken cancellationToken = default);

    Task<bool> ClearTrashAsync(
        Guid currentUserId,
        Guid spaceId,
        CancellationToken cancellationToken = default);

    Task<bool> RestoreMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task<SpaceMessageResponse?> PinMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task<bool> UnpinMessageAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken = default);
}
