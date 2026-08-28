using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions;

public interface IUserProfileSettingsService
{
    Task<UserProfileSettingsResponse?> GetProfileSettingsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<UserProfileSettingsResponse?> UpdateProfileSettingsAsync(
        Guid userId,
        UpdateUserProfileSettingsRequest request,
        CancellationToken cancellationToken = default);
}
