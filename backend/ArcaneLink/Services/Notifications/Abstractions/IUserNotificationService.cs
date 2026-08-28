using ArcaneLink.DataBase.DTOs.Notifications;

namespace ArcaneLink.Services.Notifications.Abstractions
{
    public interface IUserNotificationService
    {
        Task<IReadOnlyList<UserNotificationResponse>> GetAsync(
            Guid userId,
            CancellationToken cancellationToken = default);
        Task<bool> MarkReadAsync(
            Guid userId,
            Guid notificationId,
            CancellationToken cancellationToken = default);
        Task MarkAllReadAsync(
            Guid userId,
            CancellationToken cancellationToken = default);
        Task<int> ClearHistoryAsync(
            Guid userId,
            CancellationToken cancellationToken = default);
        Task<bool> StageInviteReadAsync(
            Guid userId,
            Guid inviteId,
            CancellationToken cancellationToken = default);
        Task StageDirectInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default);
        Task StagePrivateSpaceInviteAsync(
            Guid targetUserId,
            Guid actorUserId,
            Guid spaceId,
            string spaceTitle,
            CancellationToken cancellationToken = default);
        Task StageFriendRequestAsync(
            Guid targetUserId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);
        Task<bool> StageFriendRequestReadAsync(
            Guid targetUserId,
            Guid actorUserId,
            CancellationToken cancellationToken = default);
        Task<IReadOnlyList<Guid>> StageMentionsAsync(
            Guid actorUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            string body,
            CancellationToken cancellationToken = default);
        Task<IReadOnlyList<Guid>> StageResolvedMentionsAsync(
            Guid actorUserId,
            Guid? serverId,
            Guid spaceId,
            string spaceTitle,
            Guid messageId,
            string? body,
            IReadOnlyCollection<Guid> recipientUserIds,
            CancellationToken cancellationToken = default);
        Task NotifyChangedAsync(
            IReadOnlyCollection<Guid> userIds,
            CancellationToken cancellationToken = default);
        Task CreateSystemAsync(
            Guid userId,
            string title,
            string body,
            string? detail = null,
            CancellationToken cancellationToken = default);
    }
}
