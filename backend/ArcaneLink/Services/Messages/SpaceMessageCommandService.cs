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
            _db = db;
            _assetService = assetService;
            _attachments = attachments;
            _access = access;
            _notifier = notifier;
            _notifications = notifications;
            _mentions = mentions;
            _logger = logger;
        }

        public async Task<SpaceMessageResponse?> CreateMessageAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CreateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            if (await _access.GetWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "space_not_accessible");
                return null;
            }

            if (!HasMessageContent(request))
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "empty_message");
                return null;
            }

            var requestedAttachments = ResolveAttachments(request);
            if (requestedAttachments.Count > 0 &&
                await _access.GetAttachableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "attach_files_denied");
                return null;
            }

            if (SpaceMessageContentPolicy.ContainsExternalLink(request.Body) &&
                await _access.GetLinkWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "send_links_denied");
                return null;
            }

            if (!await IsValidReplyAsync(spaceId, request.ReplyToMessageId, cancellationToken))
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_reply");
                return null;
            }

            var now = DateTime.UtcNow;
            var messageId = Guid.NewGuid();
            var attachmentValidation = await _attachments.BuildAttachmentsAsync(
                currentUserId,
                messageId,
                requestedAttachments,
                cancellationToken);

            if (!attachmentValidation.IsValid)
            {
                LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_attachments");
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

            _db.SpaceMessages.Add(message);
            var mentionResult = await _mentions.ResolveAndStageServerAsync(
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
                LogMessageSendFailed(currentUserId, serverId, spaceId, "invalid_mentions");
                return null;
            }
            await _db.SaveChangesAsync(cancellationToken);
            await _notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await _notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                message.Id,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                _db,
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
            if (await _access.GetAttachableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            return await _assetService.UploadMessageAttachmentAsync(
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
            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                .Include(x => x.Mentions)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null ||
                !await _access.CanEditMessageAsync(
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
                await _access.GetLinkWritableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var normalizedBody = NormalizeOptional(request.Body);
            var mentionResult = await _mentions.ResolveAndStageServerAsync(
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
            await _db.SaveChangesAsync(cancellationToken);
            await _notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await _notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                message.Id,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                _db,
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
            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null ||
                !await _access.CanMutateMessageAsync(
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
            await _db.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyMessagesChangedAsync(
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
            if (await _access.GetPinnableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null)
            {
                return null;
            }

            var message = await _db.SpaceMessages
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
            var pinnedMessage = await _db.SpacePinnedMessages
                .FirstOrDefaultAsync(
                    x => x.SpaceId == spaceId && x.MessageId == messageId,
                    cancellationToken);

            if (pinnedMessage == null)
            {
                _db.SpacePinnedMessages.Add(new SpacePinnedMessage
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

            await _db.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyMessagesChangedAsync(
                serverId,
                spaceId,
                messageId,
                cancellationToken);

            return await SpaceMessageQueryService.LoadMutationResponseAsync(
                _db,
                currentUserId,
                serverId,
                spaceId,
                messageId,
                cancellationToken);
        }

        private async Task<bool> IsValidReplyAsync(
            Guid spaceId,
            Guid? replyToMessageId,
            CancellationToken cancellationToken)
        {
            return replyToMessageId == null ||
                   await _db.SpaceMessages.AnyAsync(
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
            _logger.LogWarning(
                ObservabilityEventIds.MessageSendFailed,
                "Message send failed. UserId={UserId} ServerId={ServerId} SpaceId={SpaceId} Reason={Reason}",
                currentUserId,
                serverId,
                spaceId,
                reason);
        }
    }
}
