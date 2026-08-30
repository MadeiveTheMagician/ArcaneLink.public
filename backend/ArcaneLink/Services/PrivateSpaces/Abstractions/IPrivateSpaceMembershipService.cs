using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.PrivateSpaces.Abstractions;

public interface IPrivateSpaceMembershipService
{
    Task<PrivateSpaceMembershipMutationResponse?> AddMemberAsync(
        Guid currentUserId,
        Guid spaceId,
        AddPrivateSpaceMemberRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> LeaveAsync(
        Guid currentUserId,
        Guid spaceId,
        CancellationToken cancellationToken = default);

    Task<bool> ClearHistoryAsync(
        Guid currentUserId,
        Guid spaceId,
        CancellationToken cancellationToken = default);

    Task<bool> RemoveMemberAsync(
        Guid currentUserId,
        Guid spaceId,
        Guid memberId,
        CancellationToken cancellationToken = default);
}
