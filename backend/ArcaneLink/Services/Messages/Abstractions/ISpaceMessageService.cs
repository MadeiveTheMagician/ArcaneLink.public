using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Assets;

namespace ArcaneLink.Services.Messages.Abstractions
{
    public interface ISpaceMessageService
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

        Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default);
    }
}
