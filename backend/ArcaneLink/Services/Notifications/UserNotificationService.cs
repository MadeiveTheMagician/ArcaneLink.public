using System.Text.RegularExpressions;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.Models.NotificationsModels;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Notifications
{
    public partial class UserNotificationService : IUserNotificationService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly SpaceMessageAccessService _messageAccess;
        private readonly ILogger<UserNotificationService> _logger;

        public UserNotificationService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            SpaceMessageAccessService messageAccess,
            ILogger<UserNotificationService> logger)
        {
            _db = db;
            _realtime = realtime;
            _messageAccess = messageAccess;
            _logger = logger;
        }

        public async Task<IReadOnlyList<UserNotificationResponse>> GetAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var notifications = await _db.UserNotifications
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(400)
                .Select(x => new UserNotificationResponse
                {
                    Id = x.Id,
                    Kind = x.Kind,
                    Title = x.Title,
                    Body = x.Body,
                    Detail = x.Detail,
                    ActorUserId = x.ActorUserId,
                    ActorDisplayName = x.ActorUser != null ? x.ActorUser.Profile.DisplayName : null,
                    ActorAvatarAssetId = x.ActorUser != null ? x.ActorUser.Profile.AvatarAssetId : null,
                    ActorAvatarCropOffsetX = x.ActorUser != null ? x.ActorUser.Profile.AvatarCropOffsetX : 0,
                    ActorAvatarCropOffsetY = x.ActorUser != null ? x.ActorUser.Profile.AvatarCropOffsetY : 0,
                    ActorAvatarCropZoom = x.ActorUser != null ? x.ActorUser.Profile.AvatarCropZoom : 1,
                    ServerId = x.ServerId,
                    ServerTitle = x.Server != null ? x.Server.Title : null,
                    ServerIconAssetId = x.Server != null ? x.Server.IconAssetId : null,
                    ServerIconCropOffsetX = x.Server != null ? x.Server.IconCropOffsetX : 0,
                    ServerIconCropOffsetY = x.Server != null ? x.Server.IconCropOffsetY : 0,
                    ServerIconCropZoom = x.Server != null ? x.Server.IconCropZoom : 1,
                    SpaceId = x.SpaceId,
                    SpaceTitle = x.Space != null ? x.Space.Title : null,
                    MessageId = x.MessageId,
                    MessageCreatedAt = x.Message != null ? x.Message.CreatedAt : null,
                    InviteId = x.InviteId,
                    CreatedAt = x.CreatedAt,
                    ReadAt = x.ReadAt
                })
                .ToListAsync(cancellationToken);
            var allowedSpaceIdsByServer = new Dictionary<Guid, HashSet<Guid>>();
            var mentionMessageIds = notifications
                .Where(x =>
                    x.Kind == UserNotificationText.MentionKind &&
                    x.MessageId.HasValue)
                .Select(x => x.MessageId!.Value)
                .Distinct()
                .ToList();
            var visibleMentionMessageIds = mentionMessageIds.Count == 0
                ? []
                : (await _db.SpaceMessages
                    .AsNoTracking()
                    .Where(message =>
                        mentionMessageIds.Contains(message.Id) &&
                        message.DeletedAt == null &&
                        message.Space.DeletedAt == null &&
                        !message.UserDeletions.Any(deletion => deletion.UserId == userId) &&
                        (message.Space.ServerId != null ||
                         message.Space.PrivateSpace != null &&
                         message.Space.PrivateSpace.DeletedAt == null &&
                         message.Space.PrivateSpace.Members.Any(member =>
                             member.UserId == userId &&
                             member.StatusId == DataBase.Constants.PrivateSpaceIds.MemberStatusActive &&
                             member.User.StatusId == DataBase.Constants.UserStatusIds.Active &&
                             member.User.DeletedAt == null)))
                    .Select(message => message.Id)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
            foreach (var serverId in notifications
                .Where(x =>
                    x.Kind == UserNotificationText.MentionKind &&
                    x.ServerId.HasValue)
                .Select(x => x.ServerId!.Value)
                .Distinct())
            {
                var allowedSpaceIds = await _messageAccess.GetReadableMessageSpaceIdsAsync(
                    userId,
                    serverId,
                    cancellationToken);
                allowedSpaceIdsByServer[serverId] = allowedSpaceIds?.ToHashSet() ?? [];
            }

            return notifications
                .Where(notification =>
                    notification.Kind != UserNotificationText.MentionKind ||
                    notification.MessageId.HasValue &&
                    visibleMentionMessageIds.Contains(notification.MessageId.Value) &&
                    (!notification.ServerId.HasValue ||
                     notification.SpaceId.HasValue &&
                     allowedSpaceIdsByServer
                         .GetValueOrDefault(notification.ServerId.Value)?
                         .Contains(notification.SpaceId.Value) == true))
                .Take(200)
                .ToList();
        }

        public async Task<bool> MarkReadAsync(
            Guid userId,
            Guid notificationId,
            CancellationToken cancellationToken = default)
        {
            var notification = await _db.UserNotifications.FirstOrDefaultAsync(
                x => x.Id == notificationId && x.UserId == userId,
                cancellationToken);
            if (notification == null)
            {
                return false;
            }

            notification.ReadAt ??= DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            await NotifyChangedAsync([userId], cancellationToken);
            return true;
        }

        public async Task MarkAllReadAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            await _db.UserNotifications
                .Where(x => x.UserId == userId && x.ReadAt == null)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(x => x.ReadAt, now),
                    cancellationToken);
            await NotifyChangedAsync([userId], cancellationToken);
        }

        public async Task<int> ClearHistoryAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var deletedCount = await _db.UserNotifications
                .Where(x => x.UserId == userId && x.ReadAt != null)
                .ExecuteDeleteAsync(cancellationToken);
            if (deletedCount > 0)
            {
                await NotifyChangedAsync([userId], cancellationToken);
            }

            return deletedCount;
        }

        public async Task<bool> StageInviteReadAsync(
            Guid userId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var notifications = await _db.UserNotifications
                .Where(x =>
                    x.UserId == userId &&
                    x.InviteId == inviteId &&
                    x.ReadAt == null)
                .ToListAsync(cancellationToken);
            foreach (var notification in notifications)
            {
                notification.ReadAt = now;
            }

            return notifications.Count > 0;
        }

        public async Task StageDirectInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            var serverTitle = await _db.Servers
                .Where(x => x.Id == serverId)
                .Select(x => x.Title)
                .FirstAsync(cancellationToken);

            _db.UserNotifications.Add(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = targetUserId,
                Kind = UserNotificationText.InviteKind,
                Title = UserNotificationText.InviteTitle,
                Body = serverTitle,
                ActorUserId = actorUserId,
                ServerId = serverId,
                InviteId = inviteId,
                CreatedAt = DateTime.UtcNow
            });
        }

        public Task StagePrivateSpaceInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid spaceId,
            string spaceTitle,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _db.UserNotifications.Add(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = targetUserId,
                Kind = UserNotificationText.PrivateSpaceInviteKind,
                Title = UserNotificationText.PrivateSpaceInviteTitle,
                Body = UserNotificationText.PrivateSpaceInviteBody(spaceTitle),
                ActorUserId = actorUserId,
                SpaceId = spaceId,
                CreatedAt = DateTime.UtcNow
            });

            return Task.CompletedTask;
        }

        public async Task StageFriendRequestAsync(
            Guid targetUserId,
            Guid actorUserId,
            CancellationToken cancellationToken = default)
        {
            var actorDisplayName = await _db.UserProfiles
                .Where(profile => profile.UserId == actorUserId)
                .Select(profile => profile.DisplayName)
                .SingleAsync(cancellationToken);

            _db.UserNotifications.Add(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = targetUserId,
                Kind = UserNotificationText.FriendRequestKind,
                Title = UserNotificationText.FriendRequestTitle,
                Body = UserNotificationText.FriendRequestBody(actorDisplayName),
                ActorUserId = actorUserId,
                CreatedAt = DateTime.UtcNow
            });
        }

        public async Task<bool> StageFriendRequestReadAsync(
            Guid targetUserId,
            Guid actorUserId,
            CancellationToken cancellationToken = default)
        {
            var notifications = await _db.UserNotifications
                .Where(notification =>
                    notification.UserId == targetUserId &&
                    notification.ActorUserId == actorUserId &&
                    notification.Kind == UserNotificationText.FriendRequestKind &&
                    notification.ReadAt == null)
                .ToListAsync(cancellationToken);
            if (notifications.Count == 0)
            {
                return false;
            }

            var now = DateTime.UtcNow;
            foreach (var notification in notifications)
            {
                notification.ReadAt = now;
            }

            return true;
        }

        public async Task<IReadOnlyList<Guid>> StageMentionsAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            string body,
            CancellationToken cancellationToken = default)
        {
            var loginNorms = MentionRegex()
                .Matches(body)
                .Select(match => match.Groups[1].Value.Trim().ToUpperInvariant())
                .Distinct()
                .ToArray();
            if (loginNorms.Length == 0)
            {
                return [];
            }

            var context = await _db.Spaces
                .Where(x => x.Id == spaceId && x.ServerId == serverId)
                .Select(x => new { SpaceTitle = x.Title, ServerTitle = x.Server!.Title })
                .FirstOrDefaultAsync(cancellationToken);
            if (context == null)
            {
                return [];
            }

            var targets = await _db.ServerMembers
                .Where(x =>
                    x.ServerId == serverId &&
                    x.UserId != actorUserId &&
                    x.StatusId == DataBase.Constants.ServerMemberStatusIds.Active &&
                    x.User.StatusId == DataBase.Constants.UserStatusIds.Active &&
                    loginNorms.Contains(x.User.LoginNorm))
                .Select(x => x.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);
            if (targets.Count == 0)
            {
                return [];
            }

            targets = (await _messageAccess.FilterReadableMessageUserIdsAsync(
                serverId,
                spaceId,
                targets,
                cancellationToken)).ToList();
            if (targets.Count == 0)
            {
                return [];
            }

            var preview = UserNotificationText.CreatePreview(body);
            foreach (var targetUserId in targets)
            {
                _db.UserNotifications.Add(new UserNotification
                {
                    Id = Guid.NewGuid(),
                    UserId = targetUserId,
                    Kind = UserNotificationText.MentionKind,
                    Title = UserNotificationText.MentionTitle,
                    Body = UserNotificationText.MentionBody(
                        context.SpaceTitle,
                        context.ServerTitle),
                    Detail = preview,
                    ActorUserId = actorUserId,
                    ServerId = serverId,
                    SpaceId = spaceId,
                    MessageId = messageId,
                    CreatedAt = DateTime.UtcNow
                });
            }

            return targets;
        }

        public async Task<IReadOnlyList<Guid>> StageResolvedMentionsAsync(
            Guid actorUserId,
            Guid? serverId,
            Guid spaceId,
            string spaceTitle,
            Guid messageId,
            string? body,
            IReadOnlyCollection<Guid> recipientUserIds,
            CancellationToken cancellationToken = default)
        {
            if (recipientUserIds.Count == 0)
            {
                return [];
            }

            var recipients = recipientUserIds
                .Where(userId => userId != actorUserId)
                .Distinct()
                .ToList();
            if (serverId.HasValue)
            {
                recipients = (await _messageAccess.FilterReadableMessageUserIdsAsync(
                    serverId.Value,
                    spaceId,
                    recipients,
                    cancellationToken)).ToList();
                if (recipients.Count == 0)
                {
                    return [];
                }
            }

            var existing = await _db.UserNotifications
                .Where(x =>
                    x.Kind == UserNotificationText.MentionKind &&
                    x.MessageId == messageId &&
                    recipients.Contains(x.UserId))
                .Select(x => x.UserId)
                .ToListAsync(cancellationToken);
            var missing = recipients.Except(existing).ToList();
            if (missing.Count == 0)
            {
                return [];
            }

            var preview = UserNotificationText.CreatePreview(body ?? string.Empty);
            var serverTitle = serverId.HasValue
                ? await _db.Servers
                    .Where(server => server.Id == serverId.Value)
                    .Select(server => server.Title)
                    .SingleAsync(cancellationToken)
                : null;
            var now = DateTime.UtcNow;
            foreach (var userId in missing)
            {
                _db.UserNotifications.Add(new UserNotification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Kind = UserNotificationText.MentionKind,
                    Title = UserNotificationText.MentionTitle,
                    Body = serverId.HasValue
                        ? UserNotificationText.MentionBody(spaceTitle, serverTitle!)
                        : UserNotificationText.PrivateMentionBody(spaceTitle),
                    Detail = preview,
                    ActorUserId = actorUserId,
                    ServerId = serverId,
                    SpaceId = spaceId,
                    MessageId = messageId,
                    CreatedAt = now
                });
            }

            return missing;
        }

        public async Task CreateSystemAsync(
            Guid userId,
            string title,
            string body,
            string? detail = null,
            CancellationToken cancellationToken = default)
        {
            _db.UserNotifications.Add(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Kind = UserNotificationText.SystemKind,
                Title = title.Trim(),
                Body = body.Trim(),
                Detail = string.IsNullOrWhiteSpace(detail)
                    ? null
                    : UserNotificationText.CreatePreview(detail),
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(cancellationToken);
            await NotifyChangedAsync([userId], cancellationToken);
        }

        public async Task NotifyChangedAsync(
            IReadOnlyCollection<Guid> userIds,
            CancellationToken cancellationToken = default)
        {
            foreach (var userId in userIds.Distinct())
            {
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    userId,
                    RealtimeEventNames.UserNotificationsChanged,
                    new { userId },
                    cancellationToken);
            }
        }

        [GeneratedRegex(@"(?<![\p{L}\p{N}_])@([\p{L}\p{N}_.-]{1,64})", RegexOptions.CultureInvariant)]
        private static partial Regex MentionRegex();
    }
}
