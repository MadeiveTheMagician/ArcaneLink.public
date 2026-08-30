using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions;

public interface IUserProfileAssetService
{
    Task<OwnUserProfileResponse?> SetAvatarAsync(
        Guid userId,
        Guid assetId,
        SetAvatarRequest request,
        CancellationToken cancellationToken = default);

    Task<OwnUserProfileResponse?> SetBannerAsync(
        Guid userId,
        Guid assetId,
        CancellationToken cancellationToken = default);

    Task<OwnUserProfileResponse?> ClearBannerAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<OwnUserProfileResponse?> UploadAvatarAsync(
        Guid userId,
        UploadProfileAssetRequest request,
        CancellationToken cancellationToken = default);

    Task<OwnUserProfileResponse?> UploadBannerAsync(
        Guid userId,
        UploadProfileAssetRequest request,
        CancellationToken cancellationToken = default);
}
