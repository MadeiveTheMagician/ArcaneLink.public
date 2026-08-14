using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions
{
    public interface IUserProfileService
    {
        Task<UserResponse?> GetCurrentUserAsync(
            Guid userId,
            CancellationToken cancellationToken = default);

        Task<PublicUserProfileResponse?> GetPublicProfileAsync(
            Guid userId,
            Guid? viewerUserId = null,
            CancellationToken cancellationToken = default);

        Task<OwnUserProfileResponse?> GetOwnProfileAsync(
            Guid userId,
            CancellationToken cancellationToken = default);

        Task<OwnUserProfileResponse?> UpdateProfileAsync(
            Guid userId,
            UpdateUserProfileRequest request,
            CancellationToken cancellationToken = default);

    }
}
