using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Messages.Abstractions;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Exceptions.UsersExceptions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.PrivateSpaces.PrivateSpaceTextNormalizer;

namespace ArcaneLink.Services.PrivateSpaces
{
    public class PrivateSpaceMessageService : IPrivateSpaceMessageService
    {
        private readonly AppDbContext _db;
        private readonly IAssetService _assetService;
        private readonly ISpaceMessageAttachmentService _attachments;
        private readonly PrivateSpaceAccessService _access;
        private readonly PrivateSpaceActivityService _activity;
        private readonly PrivateSpaceRealtimeNotifier _notifier;
        private readonly TimeProvider _timeProvider;
        private readonly SpaceMessageMentionService _mentions;
        private readonly IUserNotificationService _notifications;
        private readonly IDirectMessagePrivacyService _directMessagePrivacy;
        private readonly PrivateMessageTrashCleanupRunner _trashCleanupRunner;

        private static readonly TimeSpan RestoreWindow = TimeSpan.FromHours(24);

        public PrivateSpaceMessageService(
            AppDbContext db,
            IAssetService assetService,
            ISpaceMessageAttachmentService attachments,
            PrivateSpaceAccessService access,
            PrivateSpaceActivityService activity,
            PrivateSpaceRealtimeNotifier notifier,
            SpaceMessageMentionService mentions,
            IUserNotificationService notifications,
            IDirectMessagePrivacyService directMessagePrivacy,
            PrivateMessageTrashCleanupRunner trashCleanupRunner,
            TimeProvider timeProvider)
        {
            _db = db;
            _assetService = assetService;
            _attachments = attachments;
            _access = access;
            _activity = activity;
            _notifier = notifier;
            _mentions = mentions;
            _notifications = notifications;
            _directMessagePrivacy = directMessagePrivacy;
            _trashCleanupRunner = trashCleanupRunner;
            _timeProvider = timeProvider;
        }

        public async Task<IReadOnlyList<SpaceMessageResponse>?> GetMessagesAsync(
            Guid currentUserId,
            Guid spaceId,
            int limit = 100,
            DateTime? beforeCreatedAt = null,
            Guid? beforeId = null,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var take = Math.Clamp(limit, 1, 100);
            var query = LoadMessagesQuery().Where(x =>
                x.SpaceId == spaceId &&
                x.DeletedAt == null &&
                !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId))
                .ApplyHistoryCutoff(_db, currentUserId);

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

            var responses = messages
                .OrderBy(x => x.CreatedAt)
                .ThenBy(x => x.Id)
                .Select(message => SpaceMessageMapper.ToResponse(message, currentUserId))
                .ToList();
            await ApplyPrivateReceiptsAsync(
                currentUserId,
                spaceId,
                responses,
                cancellationToken);
            return responses;
        }

        public async Task<IReadOnlyList<SpaceMessageResponse>?> SearchMessagesAsync(
            Guid currentUserId,
            Guid spaceId,
            string query,
            Guid? senderUserId = null,
            string? attachmentType = null,
            int limit = 30,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var normalizedQuery = NormalizeSearchQuery(query);
            var normalizedAttachmentType = NormalizeSearchQuery(attachmentType ?? string.Empty);
            if (normalizedQuery == null &&
                senderUserId == null &&
                normalizedAttachmentType == null)
            {
                return [];
            }

            var take = Math.Clamp(limit, 1, 50);
            var messageQuery = LoadMessagesQuery()
                .Where(
                    x => x.SpaceId == spaceId &&
                         x.DeletedAt == null &&
                         !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId))
                .ApplyHistoryCutoff(_db, currentUserId);

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

            var responses = messages
                .Select(message => SpaceMessageMapper.ToResponse(message, currentUserId))
                .ToList();
            await ApplyPrivateReceiptsAsync(
                currentUserId,
                spaceId,
                responses,
                cancellationToken);
            return responses;
        }

        public async Task<IReadOnlyList<SpaceMessageResponse>?> GetPinnedMessagesAsync(
            Guid currentUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var pinnedMessageIds = await _db.SpacePinnedMessages
                .AsNoTracking()
                .Where(x => x.SpaceId == spaceId && x.UnpinnedAt == null)
                .OrderByDescending(x => x.PinnedAt)
                .Select(x => x.MessageId)
                .ToListAsync(cancellationToken);

            var messagesById = await LoadMessagesQuery()
                .Where(x =>
                    pinnedMessageIds.Contains(x.Id) &&
                    x.DeletedAt == null &&
                    !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId))
                .ApplyHistoryCutoff(_db, currentUserId)
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            var responses = pinnedMessageIds
                .Select(id => messagesById.GetValueOrDefault(id))
                .Where(message => message != null)
                .Select(message => SpaceMessageMapper.ToResponse(message!, currentUserId))
                .ToList();
            await ApplyPrivateReceiptsAsync(
                currentUserId,
                spaceId,
                responses,
                cancellationToken);
            return responses;
        }

        public async Task<AssetResponse?> UploadAttachmentAsync(
            Guid currentUserId,
            Guid spaceId,
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            return await _assetService.UploadMessageAttachmentAsync(
                currentUserId,
                file,
                cancellationToken);
        }

        public async Task<SpaceMessageResponse?> CreateMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            CreateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken) ||
                !HasMessageContent(request) ||
                !await IsValidReplyAsync(
                    currentUserId,
                    spaceId,
                    request.ReplyToMessageId,
                    cancellationToken))
            {
                return null;
            }
            if (!await _directMessagePrivacy.CanSendDirectMessageAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken))
            {
                throw new DirectMessagePrivacyDeniedException();
            }

            var now = DateTime.UtcNow;
            var messageId = Guid.NewGuid();
            var requestedAttachments = ResolveAttachments(request);
            var attachmentValidation = await _attachments.BuildAttachmentsAsync(
                currentUserId,
                messageId,
                requestedAttachments,
                cancellationToken);

            if (!attachmentValidation.IsValid)
            {
                return null;
            }

            var normalizedBody = NormalizeOptional(request.Body);
            var message = new SpaceMessage
            {
                Id = messageId,
                SpaceId = spaceId,
                SenderUserId = currentUserId,
                MessageTypeId = requestedAttachments.Count > 0
                    ? SpaceIds.MessageTypeMedia
                    : SpaceIds.MessageTypeText,
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

            var recipientUserIds = await _db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.SpaceId == spaceId &&
                    member.UserId != currentUserId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive)
                .Select(member => member.UserId)
                .Distinct()
                .ToArrayAsync(cancellationToken);
            foreach (var recipientUserId in recipientUserIds)
            {
                message.Recipients.Add(new PrivateMessageRecipient
                {
                    MessageId = message.Id,
                    UserId = recipientUserId
                });
            }

            _db.SpaceMessages.Add(message);
            var mentionResult = await _mentions.ResolveAndStagePrivateAsync(
                currentUserId,
                spaceId,
                message,
                normalizedBody,
                AdjustMentionOffsets(request.Body, request.Mentions),
                replaceExisting: false,
                cancellationToken);
            if (mentionResult == null)
            {
                return null;
            }
            await _activity.RecordMessageActivityAsync(
                spaceId,
                now,
                cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await _notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await _notifier.NotifyMessageReceivedAsync(
                spaceId,
                message.Id,
                currentUserId,
                CancellationToken.None);
            await NotifyPrivateMessagesChangedAsync(
                spaceId,
                message.Id,
                CancellationToken.None);
            await NotifyPrivateSpacesChangedAsync(
                spaceId,
                CancellationToken.None);

            return await GetMessageAsync(currentUserId, spaceId, message.Id, cancellationToken);
        }

        public async Task<SpaceMessageResponse?> UpdateMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            UpdateSpaceMessageRequest request,
            CancellationToken cancellationToken = default)
        {
            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                    .ThenInclude(x => x.PrivateSpace)
                .Include(x => x.Mentions)
                .ApplyHistoryCutoff(_db, currentUserId)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.PrivateSpace != null &&
                         x.Space.PrivateSpace.DeletedAt == null &&
                         x.DeletedAt == null &&
                         !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
                    cancellationToken);

            if (message == null ||
                !await CanMutateOwnMessageAsync(currentUserId, message, cancellationToken) ||
                string.IsNullOrWhiteSpace(request.Body))
            {
                return null;
            }
            if (!await _directMessagePrivacy.CanSendDirectMessageAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken))
            {
                throw new DirectMessagePrivacyDeniedException();
            }

            var normalizedBody = NormalizeOptional(request.Body);
            var mentionResult = await _mentions.ResolveAndStagePrivateAsync(
                currentUserId,
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
            await TouchPrivateSpaceAsync(spaceId, now, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await _notifications.NotifyChangedAsync(
                mentionResult.NotifiedUserIds,
                CancellationToken.None);
            await NotifyPrivateMessagesChangedAsync(
                spaceId,
                message.Id,
                CancellationToken.None);
            await NotifyPrivateSpacesChangedAsync(
                spaceId,
                CancellationToken.None);

            return await GetMessageAsync(currentUserId, spaceId, message.Id, cancellationToken);
        }

        public async Task<bool> DeleteMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            string scope,
            CancellationToken cancellationToken = default)
        {
            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                    .ThenInclude(x => x.PrivateSpace)
                .ApplyHistoryCutoff(_db, currentUserId)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.PrivateSpace != null &&
                         x.Space.PrivateSpace.DeletedAt == null &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (message == null ||
                !await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return false;
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            if (scope == "me")
            {
                var existing = await _db.SpaceMessageUserDeletions
                    .FirstOrDefaultAsync(
                        x => x.MessageId == messageId && x.UserId == currentUserId,
                        cancellationToken);
                if (existing == null)
                {
                    _db.SpaceMessageUserDeletions.Add(new SpaceMessageUserDeletion
                    {
                        MessageId = messageId,
                        UserId = currentUserId,
                        DeletedAt = now,
                        RestoreUntil = now.Add(RestoreWindow)
                    });
                }

                await _db.SaveChangesAsync(cancellationToken);
                await _notifier.NotifyMessagesChangedForUserAsync(
                    currentUserId,
                    spaceId,
                    message.Id,
                    cancellationToken);
                await _notifier.NotifySpacesChangedForUserAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken);
                return true;
            }

            if (scope != "everyone" || currentUserId != message.SenderUserId)
            {
                return false;
            }

            message.DeletedAt = now;
            message.DeletedByUserId = currentUserId;
            message.UpdatedAt = now;
            await TouchPrivateSpaceAsync(spaceId, now, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await NotifyPrivateMessagesChangedAsync(spaceId, message.Id, cancellationToken);
            await NotifyPrivateSpacesChangedAsync(spaceId, cancellationToken);

            return true;
        }

        public async Task<IReadOnlyList<PrivateSpaceTrashMessageResponse>?> GetTrashAsync(
            Guid currentUserId,
            Guid spaceId,
            int limit = 100,
            DateTime? beforeDeletedAt = null,
            Guid? beforeId = null,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var take = Math.Clamp(limit, 1, 100);
            var globalQuery = LoadMessagesQuery()
                .Where(message =>
                    message.SpaceId == spaceId &&
                    message.DeletedAt != null &&
                    message.DeletedByUserId == currentUserId &&
                    message.DeletedAt > now.Subtract(RestoreWindow))
                .ApplyHistoryCutoff(_db, currentUserId);
            if (beforeDeletedAt.HasValue && beforeId.HasValue)
            {
                var cursorDeletedAt = beforeDeletedAt.Value;
                var cursorId = beforeId.Value;
                globalQuery = globalQuery.Where(message =>
                    message.DeletedAt < cursorDeletedAt ||
                    (message.DeletedAt == cursorDeletedAt && message.Id.CompareTo(cursorId) < 0));
            }

            var globalMessages = await globalQuery
                .OrderByDescending(message => message.DeletedAt)
                .ThenByDescending(message => message.Id)
                .Take(take)
                .ToListAsync(cancellationToken);

            var personalDeletionQuery = _db.SpaceMessageUserDeletions
                .AsNoTracking()
                .Where(deletion =>
                    deletion.UserId == currentUserId &&
                    deletion.RestoreUntil > now &&
                    deletion.Message.SpaceId == spaceId &&
                    deletion.Message.DeletedAt == null &&
                    _db.PrivateSpaceMembers.Any(member =>
                        member.SpaceId == deletion.Message.SpaceId &&
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive &&
                        (!member.HistoryClearedAt.HasValue ||
                         deletion.Message.CreatedAt >
                         member.HistoryClearedAt.Value)));
            if (beforeDeletedAt.HasValue && beforeId.HasValue)
            {
                var cursorDeletedAt = beforeDeletedAt.Value;
                var cursorId = beforeId.Value;
                personalDeletionQuery = personalDeletionQuery.Where(deletion =>
                    deletion.DeletedAt < cursorDeletedAt ||
                    (deletion.DeletedAt == cursorDeletedAt &&
                     deletion.MessageId.CompareTo(cursorId) < 0));
            }

            var personalDeletions = await personalDeletionQuery
                .OrderByDescending(deletion => deletion.DeletedAt)
                .ThenByDescending(deletion => deletion.MessageId)
                .Take(take)
                .Select(deletion => new
                {
                    deletion.MessageId,
                    deletion.DeletedAt,
                    deletion.RestoreUntil
                })
                .ToListAsync(cancellationToken);

            var personalByMessageId = personalDeletions.ToDictionary(x => x.MessageId);
            var personalMessages = personalByMessageId.Count == 0
                ? []
                : await LoadMessagesQuery()
                    .Where(message => personalByMessageId.Keys.Contains(message.Id))
                    .ApplyHistoryCutoff(_db, currentUserId)
                    .ToListAsync(cancellationToken);

            var result = globalMessages.Select(message =>
            {
                var deletedAt = message.DeletedAt!.Value;
                return new PrivateSpaceTrashMessageResponse
                {
                    Message = SpaceMessageMapper.ToResponse(
                        message,
                        currentUserId,
                        includeDeletedContent: true),
                    Scope = "everyone",
                    DeletedAt = deletedAt,
                    RestoreUntil = deletedAt.Add(RestoreWindow)
                };
            }).ToList();

            result.AddRange(personalMessages.Select(message =>
            {
                var deletion = personalByMessageId[message.Id];
                return new PrivateSpaceTrashMessageResponse
                {
                    Message = SpaceMessageMapper.ToResponse(message, currentUserId),
                    Scope = "me",
                    DeletedAt = deletion.DeletedAt,
                    RestoreUntil = deletion.RestoreUntil
                };
            }));

            return result
                .OrderByDescending(x => x.DeletedAt)
                .ThenByDescending(x => x.Message.Id)
                .Take(take)
                .ToList();
        }

        public async Task<bool> ClearTrashAsync(
            Guid currentUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return false;
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var expiredDeletedAt = now.Subtract(RestoreWindow).AddTicks(-1);

            var personalDeletionCount = await _db.SpaceMessageUserDeletions
                .Where(deletion =>
                    deletion.UserId == currentUserId &&
                    deletion.RestoreUntil > now &&
                    deletion.Message.SpaceId == spaceId &&
                    deletion.Message.DeletedAt == null &&
                    _db.PrivateSpaceMembers.Any(member =>
                        member.SpaceId == deletion.Message.SpaceId &&
                        member.UserId == currentUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive &&
                        (!member.HistoryClearedAt.HasValue ||
                         deletion.Message.CreatedAt >
                         member.HistoryClearedAt.Value)))
                .ExecuteUpdateAsync(
                    update => update.SetProperty(
                        deletion => deletion.RestoreUntil,
                        now),
                    cancellationToken);

            var globalDeletionCount = await _db.SpaceMessages
                .Where(message =>
                    message.SpaceId == spaceId &&
                    message.DeletedAt != null &&
                    message.DeletedByUserId == currentUserId &&
                    message.DeletedAt > now.Subtract(RestoreWindow))
                .ApplyHistoryCutoff(_db, currentUserId)
                .ExecuteUpdateAsync(
                    update => update
                        .SetProperty(
                            message => message.DeletedAt,
                            (DateTime?)expiredDeletedAt)
                        .SetProperty(message => message.UpdatedAt, now),
                    cancellationToken);

            if (globalDeletionCount > 0)
            {
                await _trashCleanupRunner.RunOnceAsync(
                    cancellationToken,
                    spaceId,
                    currentUserId);
            }

            if (personalDeletionCount > 0 || globalDeletionCount > 0)
            {
                await NotifyPrivateMessagesChangedAsync(
                    spaceId,
                    messageId: null,
                    cancellationToken);
                await NotifyPrivateSpacesChangedAsync(spaceId, cancellationToken);
            }

            return true;
        }

        public async Task<bool> RestoreMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return false;
            }

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                    .ThenInclude(x => x.PrivateSpace)
                .ApplyHistoryCutoff(_db, currentUserId)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.PrivateSpace != null &&
                         x.Space.PrivateSpace.DeletedAt == null,
                    cancellationToken);
            if (message == null)
            {
                return false;
            }

            if (message.DeletedAt != null &&
                message.DeletedByUserId == currentUserId &&
                message.DeletedAt > now.Subtract(RestoreWindow))
            {
                message.DeletedAt = null;
                message.DeletedByUserId = null;
                message.UpdatedAt = now;

                var ownDeletion = await _db.SpaceMessageUserDeletions
                    .FirstOrDefaultAsync(
                        x => x.MessageId == messageId && x.UserId == currentUserId,
                        cancellationToken);
                if (ownDeletion != null)
                {
                    _db.SpaceMessageUserDeletions.Remove(ownDeletion);
                }

                await TouchPrivateSpaceAsync(spaceId, now, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                await NotifyPrivateMessagesChangedAsync(spaceId, messageId, cancellationToken);
                await NotifyPrivateSpacesChangedAsync(spaceId, cancellationToken);
                return true;
            }

            if (message.DeletedAt != null)
            {
                return false;
            }

            var personalDeletion = await _db.SpaceMessageUserDeletions
                .FirstOrDefaultAsync(
                    x => x.MessageId == messageId &&
                         x.UserId == currentUserId &&
                         x.RestoreUntil > now,
                    cancellationToken);
            if (personalDeletion == null)
            {
                return false;
            }

            _db.SpaceMessageUserDeletions.Remove(personalDeletion);
            await _db.SaveChangesAsync(cancellationToken);
            await _notifier.NotifyMessagesChangedForUserAsync(
                currentUserId,
                spaceId,
                messageId,
                cancellationToken);
            await _notifier.NotifySpacesChangedForUserAsync(
                currentUserId,
                spaceId,
                cancellationToken);
            return true;
        }

        public async Task<SpaceMessageResponse?> PinMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var message = await _db.SpaceMessages
                .Include(x => x.Space)
                    .ThenInclude(x => x.PrivateSpace)
                .ApplyHistoryCutoff(_db, currentUserId)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.PrivateSpace != null &&
                         x.Space.PrivateSpace.DeletedAt == null &&
                         x.DeletedAt == null &&
                         !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
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
            var wasPinned = pinnedMessage != null && pinnedMessage.UnpinnedAt == null;

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

            Guid? eventMessageId = null;
            if (!wasPinned)
            {
                eventMessageId = Guid.NewGuid();
                _db.SpaceMessages.Add(new SpaceMessage
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

            await TouchPrivateSpaceAsync(spaceId, now, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
            await NotifyPrivateMessagesChangedAsync(
                spaceId,
                eventMessageId ?? messageId,
                cancellationToken);
            if (eventMessageId.HasValue)
            {
                await NotifyPrivateSpacesChangedAsync(
                    spaceId,
                    CancellationToken.None);
            }

            return await GetMessageAsync(currentUserId, spaceId, messageId, cancellationToken);
        }

        public async Task<bool> UnpinMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return false;
            }

            var messageExists = await _db.SpaceMessages
                .ApplyHistoryCutoff(_db, currentUserId)
                .AnyAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.PrivateSpace != null &&
                         x.Space.PrivateSpace.DeletedAt == null &&
                         x.DeletedAt == null &&
                         !x.UserDeletions.Any(deletion =>
                             deletion.UserId == currentUserId),
                    cancellationToken);
            if (!messageExists)
            {
                return false;
            }

            var pinnedMessage = await _db.SpacePinnedMessages
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
            await _db.SaveChangesAsync(cancellationToken);
            await NotifyPrivateMessagesChangedAsync(
                spaceId,
                messageId,
                cancellationToken);
            return true;
        }

        private async Task<SpaceMessageResponse?> GetMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken)
        {
            if (!await IsActiveMemberAsync(currentUserId, spaceId, cancellationToken))
            {
                return null;
            }

            var message = await LoadMessagesQuery()
                .ApplyHistoryCutoff(_db, currentUserId)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.DeletedAt == null &&
                         !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
                    cancellationToken);

            if (message == null)
            {
                return null;
            }

            var response = SpaceMessageMapper.ToResponse(
                message,
                currentUserId);
            await ApplyPrivateReceiptsAsync(
                currentUserId,
                spaceId,
                [response],
                cancellationToken);
            return response;
        }

        private async Task ApplyPrivateReceiptsAsync(
            Guid currentUserId,
            Guid spaceId,
            IReadOnlyCollection<SpaceMessageResponse> messages,
            CancellationToken cancellationToken)
        {
            var ownMessages = messages
                .Where(message => message.SenderUserId == currentUserId)
                .ToArray();
            if (ownMessages.Length == 0)
            {
                return;
            }

            var ownMessageIds = ownMessages
                .Select(message => message.Id)
                .ToArray();
            var recipientSnapshots = await _db.PrivateMessageRecipients
                .AsNoTracking()
                .Where(recipient =>
                    ownMessageIds.Contains(recipient.MessageId))
                .Select(recipient => new
                {
                    recipient.MessageId,
                    recipient.UserId
                })
                .ToArrayAsync(cancellationToken);
            var historicalRecipientUserIds = recipientSnapshots
                .Select(recipient => recipient.UserId)
                .Distinct()
                .ToArray();
            var readStates = await _db.SpaceReadStates
                .AsNoTracking()
                .Where(state =>
                    state.SpaceId == spaceId &&
                    historicalRecipientUserIds.Contains(state.UserId))
                .ToDictionaryAsync(state => state.UserId, cancellationToken);

            foreach (var message in ownMessages)
            {
                var recipientUserIds = recipientSnapshots
                    .Where(recipient =>
                        recipient.MessageId == message.Id)
                    .Select(recipient => recipient.UserId)
                    .Distinct()
                    .ToArray();
                var readBy = recipientUserIds
                    .Select(userId => readStates.GetValueOrDefault(userId))
                    .Where(state =>
                        state != null &&
                        IsMessageReadByState(message, state))
                    .ToArray();
                var readByAll =
                    recipientUserIds.Length > 0 &&
                    readBy.Length == recipientUserIds.Length;
                message.Receipt = new PrivateMessageReceiptResponse
                {
                    StatusCode = readByAll ? "read" : "delivered",
                    RecipientCount = recipientUserIds.Length,
                    ReadByCount = readBy.Length,
                    ReadAt = readByAll
                        ? readBy.Max(state => state!.ReadAt)
                        : null
                };
            }
        }

        private static bool IsMessageReadByState(
            SpaceMessageResponse message,
            SpaceReadState state)
        {
            if (!state.LastReadMessageCreatedAt.HasValue)
            {
                return false;
            }

            var timeComparison = state.LastReadMessageCreatedAt.Value
                .CompareTo(message.CreatedAt);
            return timeComparison > 0 ||
                   timeComparison == 0 &&
                   state.LastReadMessageId.HasValue &&
                   state.LastReadMessageId.Value.CompareTo(message.Id) >= 0;
        }

        private IQueryable<SpaceMessage> LoadMessagesQuery()
        {
            return PrivateSpaceQueries.LoadMessages(_db);
        }

        private async Task<bool> IsActiveMemberAsync(
            Guid userId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return await _access.IsActiveMemberAsync(userId, spaceId, cancellationToken);
        }

        private async Task<bool> CanMutateOwnMessageAsync(
            Guid currentUserId,
            SpaceMessage message,
            CancellationToken cancellationToken)
        {
            return currentUserId == message.SenderUserId &&
                   await IsActiveMemberAsync(currentUserId, message.SpaceId, cancellationToken);
        }

        private async Task<bool> IsValidReplyAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid? replyToMessageId,
            CancellationToken cancellationToken)
        {
            return replyToMessageId == null ||
                   await _db.SpaceMessages
                       .ApplyHistoryCutoff(_db, currentUserId)
                       .AnyAsync(
                       x => x.Id == replyToMessageId &&
                            x.SpaceId == spaceId &&
                            x.DeletedAt == null &&
                            !x.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
                       cancellationToken);
        }

        private async Task TouchPrivateSpaceAsync(
            Guid spaceId,
            DateTime updatedAt,
            CancellationToken cancellationToken)
        {
            await _activity.TouchAsync(spaceId, updatedAt, cancellationToken);
        }

        private async Task NotifyPrivateSpacesChangedAsync(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            await _notifier.NotifySpacesChangedAsync(spaceId, cancellationToken);
        }

        private async Task NotifyPrivateMessagesChangedAsync(
            Guid spaceId,
            Guid? messageId,
            CancellationToken cancellationToken)
        {
            await _notifier.NotifyMessagesChangedAsync(
                spaceId,
                messageId,
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
}
