using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Observability;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Messages.Abstractions;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages
{
    public class SpaceMessageCommandService : ISpaceMessageCommandService
    {
        private readonly AppDbContext _db;
        private readonly IAssetService _assetService;
        private readonly ISpaceMessageAttachmentService _attachments;
        private readonly SpaceMessageAccessService _access;
        private readonly SpaceMessageNotifier _notifier;
        private readonly ILogger<SpaceMessageCommandService> _logger;
        private readonly IUserNotificationService _notifications;
        private readonly SpaceMessageMentionService _mentions;

        public SpaceMessageCommandService(
            AppDbContext db,
            IAssetService assetService,
            ISpaceMessageAttachmentService attachments,
            SpaceMessageAccessService access,
            SpaceMessageNotifier notifier,
            IUserNotificationService notifications,
            SpaceMessageMentionService mentions,
            ILogger<SpaceMessageCommandService> logger)
        {
            this._db = db;
            this._assetService = assetService;
            this._attachments = attachments;
            this._access = access;
            this._notifier = notifier;
            this._notifications = notifications;
            this._mentions = mentions;
            this._logger = logger;
        }

        public async Task<SpaceMessageResponse?> CreateMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CreateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            if (await this._access.GetWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "space_not_accessible");
                return null;
            }

            if (!HasMessageContent(request))
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "empty_message");
                return null;
            }

            var requestedAttachments = ResolveAttachments(request);
            if (requestedAttachments.Count > 0 &&
                await this._access.GetAttachableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "attach_files_denied");
                return null;
            }

            if (SpaceMessageContentPolicy.ContainsExternalLink(request.Body) &&
                await this._access.GetLinkWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "send_links_denied");
                return null;
            }

            if (!await this.IsValidReplyAsync(spaceId, request.ReplyToMessageId, cancellationToken))
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_reply");
                return null;
            }

            var now = DateTime.UtcNow;
            var messageId = Guid.NewGuid();
            var attachmentValidation = await this._attachments.BuildAttachmentsAsync(
                currentUserId,
                messageId,
                requestedAttachments,
                cancellationToken);

            if (!attachmentValidation.IsValid)
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_attachments");
                return null;
            }

            var messageTypeId = requestedAttachments.Count > 0
                ? SpaceIds.MessageTypeMedia
                : SpaceIds.MessageTypeText;
            var normalizedBody = NormalizeOptional(request.Body);
            var message = new SpaceMessage
            {
                Id = messageId,
                SpaceId = spaceId,
                SenderUserId = currentUserId,
                MessageTypeId = messageTypeId,
                Body = normalizedBody,
                Payload = NormalizeOptional(request.Payload),
                ReplyToMessageId = request.ReplyToMessageId,
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var attachment in attachmentValidation.Attachments)
            {
                message.Assets.Add(attachment);
            }

            this._db.SpaceMessages.Add(message);
            var mentionResult = await this._mentions.ResolveAndStageServerAsync(
                currentUserId,
                serverId,
                spaceId,
                message,
                normalizedBody,
                AdjustMentionOffsets(request.Body, request.Mentions),
                replaceExisting: false,
                cancellationToken);
            if (mentionResult == null)
            {
                this.LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_mentions");
                return null;
            }
            await this._db.SaveChangesAsync(cancellationToken);
            await this._notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await this._notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                message.Id,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                this._db,
                currentUserId,
                serverId,
                spaceId,
                message.Id,
                cancellationToken);
        }

        public async Task<AssetResponse?> UploadAttachmentAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            if (await this._access.GetAttachableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            return await this._assetService.UploadMessageAttachmentAsync(
                currentUserId,
                file,
                cancellationToken);
        }

        public async Task<SpaceMessageResponse?> UpdateMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            UpdateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            var message = await this._db.SpaceMessages
                .Include(x => x.Space)
                .Include(x => x.Mentions)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null ||
                !await this._access.CanEditMessageAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    message.SenderUserId,
                    cancellationToken) ||
                string.IsNullOrWhiteSpace(request.Body))
            {
                return null;
            }

            if (SpaceMessageContentPolicy.ContainsExternalLink(request.Body) &&
                await this._access.GetLinkWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var normalizedBody = NormalizeOptional(request.Body);
            var mentionResult = await this._mentions.ResolveAndStageServerAsync(
                currentUserId,
                serverId,
                spaceId,
                message,
                normalizedBody,
                AdjustMentionOffsets(request.Body, request.Mentions),
                replaceExisting: true,
                cancellationToken);
            if (mentionResult == null)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            message.Body = normalizedBody;
            if (request.Payload != null || request.ClearPayload)
            {
                message.Payload = NormalizeOptional(request.Payload);
            }

            message.UpdatedAt = now;
            message.EditedAt = now;
            await this._db.SaveChangesAsync(cancellationToken);
            await this._notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await this._notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                message.Id,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                this._db,
                currentUserId,
                serverId,
                spaceId,
                message.Id,
                cancellationToken);
        }

        public async Task<bool> DeleteMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            var message = await this._db.SpaceMessages
                .Include(x => x.Space)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null ||
                !await this._access.CanMutateMessageAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    message.SenderUserId,
                    cancellationToken))
            {
                return false;
            }

            var now = DateTime.UtcNow;
            message.Body = null;
            message.Payload = null;
            message.DeletedAt = now;
            message.UpdatedAt = now;
            await this._db.SaveChangesAsync(cancellationToken);
            await this._notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                message.Id,
                cancellationToken);

            return true;
        }

        public async Task<SpaceMessageResponse?> PinMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            if (await this._access.GetPinnableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var message = await this._db.SpaceMessages
                .Include(x => x.Space)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var pinnedMessage = await this._db.SpacePinnedMessages
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId && x.MessageId == messageId,
                    cancellationToken);
            var wasPinned = pinnedMessage != null && pinnedMessage.UnpinnedAt == null;

            if (pinnedMessage == null)
            {
                this._db.SpacePinnedMessages.Add(new SpacePinnedMessage
                {
                    Id = Guid.NewGuid(),
                    SpaceId = spaceId,
                    MessageId = messageId,
                    PinnedByUserId = currentUserId,
                    PinnedAt = now
                });
            }
            else if (pinnedMessage.UnpinnedAt != null)
            {
                pinnedMessage.PinnedByUserId = currentUserId;
                pinnedMessage.PinnedAt = now;
                pinnedMessage.UnpinnedAt = null;
                pinnedMessage.UnpinnedByUserId = null;
            }

            Guid? eventMessageId = null;
            if (!wasPinned)
            {
                eventMessageId = Guid.NewGuid();
                this._db.SpaceMessages.Add(new SpaceMessage
                {
                    Id = eventMessageId.Value,
                    SpaceId = spaceId,
                    SenderUserId = currentUserId,
                    MessageTypeId = SpaceIds.MessageTypeEvent,
                    Payload = SpaceMessageEventPayload.CreateMessagePinned(messageId),
                    ReplyToMessageId = messageId,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }

            await this._db.SaveChangesAsync(cancellationToken);
            await this._notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                eventMessageId ?? messageId,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                this._db,
                currentUserId,
                serverId,
                spaceId,
                messageId,
                cancellationToken);
        }

        public async Task<bool> UnpinMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            if (await this._access.GetPinnableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return false;
            }

            var messageExists = await this._db.SpaceMessages
                .AnyAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);
            if (!messageExists)
            {
                return false;
            }

            var pinnedMessage = await this._db.SpacePinnedMessages
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId &&
                         x.MessageId == messageId &&
                         x.UnpinnedAt == null,
                    cancellationToken);
            if (pinnedMessage == null)
            {
                return false;
            }

            pinnedMessage.UnpinnedAt = DateTime.UtcNow;
            pinnedMessage.UnpinnedByUserId = currentUserId;
            await this._db.SaveChangesAsync(cancellationToken);
            await this._notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                messageId,
                cancellationToken);
            return true;
        }

        private async Task<bool> IsValidReplyAsync(
            Guid spaceId,
            Guid? replyToMessageId,
            CancellationToken cancellationToken)
        {
            return replyToMessageId == null ||
                   await this._db.SpaceMessages.AnyAsync(
                       x => x.Id == replyToMessageId &&
                            x.SpaceId == spaceId &&
                            x.DeletedAt == null,
                       cancellationToken);
        }

        private static bool HasMessageContent(CreateSpaceMessageRequest request)
        {
            return !string.IsNullOrWhiteSpace(request.Body) ||
                   !string.IsNullOrWhiteSpace(request.Payload) ||
                   request.AssetIds.Count > 0 ||
                   request.Attachments.Count > 0;
        }

        private static IReadOnlyList<CreateSpaceMessageAttachmentRequest> ResolveAttachments(
            CreateSpaceMessageRequest request)
        {
            return request.Attachments.Count > 0
                ? request.Attachments
                : request.AssetIds
                    .Select(assetId => new CreateSpaceMessageAttachmentRequest { AssetId = assetId })
                    .ToList();
        }

        private static string? NormalizeOptional(string? value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? null
                : value.Trim();
        }

        private static IReadOnlyList<SpaceMessageMentionRequest>? AdjustMentionOffsets(
            string? rawBody,
            IReadOnlyList<SpaceMessageMentionRequest>? mentions)
        {
            if (mentions == null || string.IsNullOrEmpty(rawBody))
            {
                return mentions;
            }

            var leadingTrimLength = 0;
            while (leadingTrimLength < rawBody.Length &&
                   char.IsWhiteSpace(rawBody[leadingTrimLength]))
            {
                leadingTrimLength++;
            }
            if (leadingTrimLength == 0)
            {
                return mentions;
            }

            return mentions.Select(mention => new SpaceMessageMentionRequest
            {
                Kind = mention.Kind,
                TargetId = mention.TargetId,
                Start = mention.Start - leadingTrimLength,
                Length = mention.Length
            }).ToList();
        }

        private void LogMessageSendFailed(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            string reason)
        {
            ArcaneLinkDiagnostics.MessageSendFailedCounter.Add(1);
            this._logger.LogWarning(
                ObservabilityEventIds.MessageSendFailed,
                "Message send failed. UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} Reason={Reason}",
                currentUserId,
                serverId,
                spaceId,
                reason);
        }
    }
}
