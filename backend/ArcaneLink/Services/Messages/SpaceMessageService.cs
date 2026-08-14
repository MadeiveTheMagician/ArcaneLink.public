using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.Services.Messages.Abstractions;

namespace ArcaneLink.Services.Messages
{
    public class SpaceMessageService : ISpaceMessageService
    {
        private readonly ISpaceMessageQueryService _queries;
        private readonly ISpaceMessageCommandService _commands;

        public SpaceMessageService(
            ISpaceMessageQueryService queries,
            ISpaceMessageCommandService commands)
        {
            _queries = queries;
            _commands = commands;
        }

        public Task<IReadOnlyList<SpaceMessageResponse>?> GetMessagesAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            int limit = 100,
            DateTime? beforeCreatedAt = null,
            Guid? beforeId = null,
            CancellationToken cancellationToken = default)
        {
            return _queries.GetMessagesAsync(
                currentUserId,
                serverId,
                spaceId,
                limit,
                beforeCreatedAt,
                beforeId,
                cancellationToken);
        }

        public Task<IReadOnlyList<SpaceMessageResponse>?> SearchMessagesAsync(
            Guid currentUserId,
            Guid serverId,
            string query,
            Guid? senderUserId = null,
            Guid? spaceId = null,
            string? attachmentType = null,
            int limit = 30,
            CancellationToken cancellationToken = default)
        {
            return _queries.SearchMessagesAsync(
                currentUserId,
                serverId,
                query,
                senderUserId,
                spaceId,
                attachmentType,
                limit,
                cancellationToken);
        }

        public Task<SpaceMessageResponse?> CreateMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CreateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            return _commands.CreateMessageAsync(
                currentUserId,
                serverId,
                spaceId,
                request,
                cancellationToken);
        }

        public Task<AssetResponse?> UploadAttachmentAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            return _commands.UploadAttachmentAsync(
                currentUserId,
                serverId,
                spaceId,
                file,
                cancellationToken);
        }

        public Task<SpaceMessageResponse?> UpdateMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            UpdateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            return _commands.UpdateMessageAsync(
                currentUserId,
                serverId,
                spaceId,
                messageId,
                request,
                cancellationToken);
        }

        public Task<bool> DeleteMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            return _commands.DeleteMessageAsync(
                currentUserId,
                serverId,
                spaceId,
                messageId,
                cancellationToken);
        }

        public Task<SpaceMessageResponse?> PinMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            return _commands.PinMessageAsync(
                currentUserId,
                serverId,
                spaceId,
                messageId,
                cancellationToken);
        }

        public Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            return _queries.GetPinnedMessagesAsync(
                currentUserId,
                serverId,
                spaceId,
                cancellationToken);
        }
    }
}
