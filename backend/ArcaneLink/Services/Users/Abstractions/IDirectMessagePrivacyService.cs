using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions
{
    public interface IDirectMessagePrivacyService
    {
        Task<bool> CanStartConversationAsync(
            Guid initiatorUserId,
            Guid targetUserId,
            CancellationToken cancellationToken = default);

        Task<bool> CanStartConversationsAsync(
            Guid initiatorUserId,
            IReadOnlyCollection<Guid> targetUserIds,
            CancellationToken cancellationToken = default);

        Task<bool> CanAddParticipantAsync(
            Guid initiatorUserId,
            Guid newUserId,
            IReadOnlyCollection<Guid> existingUserIds,
            CancellationToken cancellationToken = default);

        Task<bool> CanSendDirectMessageAsync(
            Guid senderUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default);

        Task<DirectMessageBlockedUsersPageResponse?> GetBlockedUsersAsync(
            Guid userId,
            int limit = 100,
            string? cursor = null,
            CancellationToken cancellationToken = default);

        Task<DirectMessageBlockStatusResponse> GetBlockStatusAsync(
            Guid userId,
            Guid blockedUserId,
            CancellationToken cancellationToken = default);

        Task<DirectMessageBlockedUserResponse?> BlockAsync(
            Guid userId,
            Guid blockedUserId,
            string? comment = null,
            bool updateComment = false,
            CancellationToken cancellationToken = default);

        Task<bool> UnblockAsync(
            Guid userId,
            Guid blockedUserId,
            CancellationToken cancellationToken = default);
    }
}
