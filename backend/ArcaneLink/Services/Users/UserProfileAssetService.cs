using System.Globalization;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.AssetExceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Users.UserProfileResponseMapper;

namespace ArcaneLink.Services.Users;

public class UserProfileAssetService : IUserProfileAssetService
{
    private readonly AppDbContext _db;
    private readonly IAssetService _assetService;
    private readonly AvatarImageProcessor _avatarImageProcessor;
    private readonly IRealtimeNotificationService _realtime;
    private readonly IUserPresencePolicyService _presencePolicy;
    private readonly ILogger<UserProfileAssetService> _logger;

    public UserProfileAssetService(
        AppDbContext db,
        IAssetService assetService,
        AvatarImageProcessor avatarImageProcessor,
        IRealtimeNotificationService realtime,
        IUserPresencePolicyService presencePolicy,
        ILogger<UserProfileAssetService> logger)
    {
        this._db = db;
        this._assetService = assetService;
        this._avatarImageProcessor = avatarImageProcessor;
        this._realtime = realtime;
        this._presencePolicy = presencePolicy;
        this._logger = logger;
    }

    public async Task<OwnUserProfileResponse?> SetAvatarAsync(
        Guid userId,
        Guid assetId,
        SetAvatarRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateAvatarCrop(request);

        var sourceAsset = await this.GetOwnedActiveAssetAsync(
            userId,
            assetId,
            cancellationToken);

        if (sourceAsset == null)
        {
            return null;
        }

        var isReusableSource = sourceAsset.AssetTypeId == AssetTypeIds.Avatar;
        var isCurrentDerivative =
            sourceAsset.AssetTypeId == AssetTypeIds.CurrentAvatar &&
            this.IsOptimizedAvatar(sourceAsset);

        if (!isReusableSource && !isCurrentDerivative)
        {
            throw new InvalidUserProfileDataException(
                ExceptionMessages.ProfileAvatarAssetTypeIsInvalid);
        }

        if (isCurrentDerivative && IsNeutralCrop(request))
        {
            var sourceAssetId = await this.GetCurrentAvatarSourceAssetIdAsync(
                userId,
                sourceAsset.Id,
                cancellationToken);
            return await this.ReplaceCurrentAvatarAsync(
                userId,
                sourceAsset.Id,
                sourceAssetId,
                cancellationToken);
        }

        var sourceContent = await this._assetService.GetAssetContentAsync(
            sourceAsset.Id,
            cancellationToken);

        if (sourceContent == null)
        {
            return null;
        }

        await using var contentStream = sourceContent.Content;
        await using var optimizedContent =
            await this._avatarImageProcessor.ProcessAsync(
                contentStream,
                request.CropOffsetX,
                request.CropOffsetY,
                request.CropZoom,
                cancellationToken);
        var optimizedAssetId = await this.UploadOptimizedAvatarAssetAsync(
            userId,
            optimizedContent,
            sourceAsset.OriginalFileName,
            cancellationToken);
        var avatarSourceAssetId = isReusableSource
            ? sourceAsset.Id
            : await this.GetCurrentAvatarSourceAssetIdAsync(
                userId,
                sourceAsset.Id,
                cancellationToken);

        OwnUserProfileResponse? profile;
        try
        {
            profile = await this.ReplaceCurrentAvatarAsync(
                userId,
                optimizedAssetId,
                avatarSourceAssetId,
                cancellationToken);
        }
        catch
        {
            await this.DeleteCompensatingAssetAsync(userId, optimizedAssetId);
            throw;
        }

        if (profile == null)
        {
            await this.DeleteCompensatingAssetAsync(userId, optimizedAssetId);
            return null;
        }

        return profile;
    }

    public async Task<OwnUserProfileResponse?> SetBannerAsync(
        Guid userId,
        Guid assetId,
        CancellationToken cancellationToken = default)
    {
        return await this.SetProfileAssetAsync(
            userId,
            assetId,
            AssetTypeIds.Banner,
            ExceptionMessages.ProfileBannerAssetTypeIsInvalid,
            static (profile, id) => profile.BannerAssetId = id,
            cancellationToken);
    }

    public async Task<OwnUserProfileResponse?> ClearBannerAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await this.GetActiveUserWithProfileAsync(
            userId,
            cancellationToken);
        if (user == null)
        {
            return null;
        }

        user.Profile.BannerAssetId = null;
        user.UpdatedAt = DateTime.UtcNow;
        user.Profile.UpdatedAt = DateTime.UtcNow;

        await this._db.SaveChangesAsync(cancellationToken);
        await this._realtime.NotifyUserAsync(
            userId,
            RealtimeEventNames.UserProfileChanged,
            new { userId, bannerAssetId = (Guid?)null },
            cancellationToken);

        var snapshots = await this._presencePolicy.ResolveAsync(
            userId,
            [userId],
            cancellationToken);
        return ToOwnProfileResponse(
            user,
            snapshots.GetValueOrDefault(
                userId,
                UserPresenceSnapshot.Hidden));
    }

    public async Task<OwnUserProfileResponse?> UploadAvatarAsync(
        Guid userId,
        UploadProfileAssetRequest request,
        CancellationToken cancellationToken = default)
    {
        if (await this.GetActiveUserWithProfileAsync(userId, cancellationToken) == null)
        {
            return null;
        }

        if (request.File == null || request.File.Length == 0)
        {
            throw new InvalidAssetDataException(
                ExceptionMessages.AssetFileIsRequired);
        }

        var crop = ParseAvatarCrop(request);
        ValidateAvatarCrop(crop);

        await using var source = request.File.OpenReadStream();
        await using var optimizedContent =
            await this._avatarImageProcessor.ProcessAsync(
                source,
                crop.CropOffsetX,
                crop.CropOffsetY,
                crop.CropZoom,
                cancellationToken);
        var sourceAssetId = await this.UploadProfileAssetAsync(
            userId,
            request,
            AssetTypeIds.Avatar,
            cancellationToken);

        if (sourceAssetId == null)
        {
            return null;
        }

        Guid assetId;
        try
        {
            assetId = await this.UploadOptimizedAvatarAssetAsync(
                userId,
                optimizedContent,
                request.File.FileName,
                cancellationToken);
        }
        catch
        {
            await this.DeleteCompensatingAssetAsync(userId, sourceAssetId.Value);
            throw;
        }

        try
        {
            var profile = await this.ReplaceCurrentAvatarAsync(
                userId,
                assetId,
                sourceAssetId.Value,
                cancellationToken);

            if (profile == null)
            {
                await this.DeleteCompensatingAssetAsync(userId, assetId);
                await this.DeleteCompensatingAssetAsync(userId, sourceAssetId.Value);
            }

            return profile;
        }
        catch
        {
            await this.DeleteCompensatingAssetAsync(userId, assetId);
            await this.DeleteCompensatingAssetAsync(userId, sourceAssetId.Value);
            throw;
        }
    }

    public async Task<OwnUserProfileResponse?> UploadBannerAsync(
        Guid userId,
        UploadProfileAssetRequest request,
        CancellationToken cancellationToken = default)
    {
        var assetId = await this.UploadProfileAssetAsync(
            userId,
            request,
            AssetTypeIds.Banner,
            cancellationToken);

        return assetId == null
            ? null
            : await this.SetBannerAsync(userId, assetId.Value, cancellationToken);
    }

    private async Task<Guid?> UploadProfileAssetAsync(
        Guid userId,
        UploadProfileAssetRequest request,
        Guid assetTypeId,
        CancellationToken cancellationToken)
    {
        var user = await this.GetActiveUserWithProfileAsync(
            userId,
            cancellationToken);

        if (user == null)
        {
            return null;
        }

        var asset = await this._assetService.UploadAssetAsync(
            userId,
            new UploadAssetRequest
            {
                AssetTypeId = assetTypeId,
                File = request.File
            },
            cancellationToken);

        return asset.Id;
    }

    private async Task<Guid> UploadOptimizedAvatarAssetAsync(
        Guid userId,
        MemoryStream content,
        string? sourceFileName,
        CancellationToken cancellationToken)
    {
        var baseName = Path.GetFileNameWithoutExtension(sourceFileName);
        var fileName = $"{(string.IsNullOrWhiteSpace(baseName) ? "avatar" : baseName)}.webp";
        var formFile = new FormFile(
            content,
            0,
            content.Length,
            "File",
            fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/webp"
        };
        var asset = await this._assetService.UploadOptimizedAvatarAsync(
            userId,
            formFile,
            this._avatarImageProcessor.OutputSizePixels,
            cancellationToken);

        return asset.Id;
    }

    private Task<OwnUserProfileResponse?> SetOptimizedAvatarAsync(
        Guid userId,
        Guid assetId,
        Guid sourceAssetId,
        CancellationToken cancellationToken)
    {
        return this.SetProfileAssetAsync(
            userId,
            assetId,
            AssetTypeIds.CurrentAvatar,
            ExceptionMessages.ProfileAvatarAssetTypeIsInvalid,
            (profile, id) =>
            {
                profile.AvatarAssetId = id;
                profile.AvatarSourceAssetId = sourceAssetId;
                profile.AvatarCropOffsetX = 0;
                profile.AvatarCropOffsetY = 0;
                profile.AvatarCropZoom = 1;
            },
            cancellationToken);
    }

    private async Task<OwnUserProfileResponse?> ReplaceCurrentAvatarAsync(
        Guid userId,
        Guid assetId,
        Guid sourceAssetId,
        CancellationToken cancellationToken)
    {
        var previousAssetId = await this._db.UserProfiles
            .Where(x => x.UserId == userId)
            .Select(x => x.AvatarAssetId)
            .FirstOrDefaultAsync(cancellationToken);
        var profile = await this.SetOptimizedAvatarAsync(
            userId,
            assetId,
            sourceAssetId,
            cancellationToken);

        if (profile == null ||
            previousAssetId == null ||
            previousAssetId == assetId)
        {
            return profile;
        }

        var previousAsset = await this.GetOwnedActiveAssetAsync(
            userId,
            previousAssetId.Value,
            cancellationToken);

        if (previousAsset?.AssetTypeId == AssetTypeIds.CurrentAvatar)
        {
            await OptimizedAvatarAssetCleanup.DeleteOwnedIfOrphanedAsync(
                this._db,
                this._assetService,
                userId,
                previousAsset.Id,
                cancellationToken);
        }

        return profile;
    }

    private async Task<Guid> GetCurrentAvatarSourceAssetIdAsync(
        Guid userId,
        Guid fallbackAssetId,
        CancellationToken cancellationToken)
    {
        return await this._db.UserProfiles
            .Where(x => x.UserId == userId)
            .Select(x => x.AvatarSourceAssetId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? fallbackAssetId;
    }

    private async Task<OwnUserProfileResponse?> SetProfileAssetAsync(
        Guid userId,
        Guid assetId,
        Guid expectedAssetTypeId,
        string invalidTypeMessage,
        Action<UserProfile, Guid> applyAsset,
        CancellationToken cancellationToken)
    {
        var user = await this.GetActiveUserWithProfileAsync(
            userId,
            cancellationToken);

        if (user == null)
        {
            return null;
        }

        var asset = await this.GetOwnedActiveAssetAsync(
            userId,
            assetId,
            cancellationToken);

        if (asset == null)
        {
            return null;
        }

        if (asset.AssetTypeId != expectedAssetTypeId)
        {
            throw new InvalidUserProfileDataException(invalidTypeMessage);
        }

        applyAsset(user.Profile, asset.Id);

        user.UpdatedAt = DateTime.UtcNow;
        user.Profile.UpdatedAt = DateTime.UtcNow;

        await this._db.SaveChangesAsync(cancellationToken);
        await this._realtime.NotifyUserAsync(
            userId,
            RealtimeEventNames.UserProfileChanged,
            new { userId, assetId },
            cancellationToken);

        var snapshots = await this._presencePolicy.ResolveAsync(
            userId,
            [userId],
            cancellationToken);

        return ToOwnProfileResponse(
            user,
            snapshots.GetValueOrDefault(
                userId,
                UserPresenceSnapshot.Hidden));
    }

    private async Task<User?> GetActiveUserWithProfileAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await this._db.Users
            .Include(x => x.Profile)
            .Include(x => x.SubscriptionType)
            .FirstOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);
    }

    private async Task<Asset?> GetOwnedActiveAssetAsync(
        Guid userId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        // Treat missing, deleted and foreign assets the same way.
        // This avoids leaking whether another user's asset exists.
        return await this._db.Assets
            .FirstOrDefaultAsync(
                x => x.Id == assetId &&
                     x.OwnerUserId == userId &&
                     x.DeletedAt == null,
                cancellationToken);
    }

    private static void ValidateAvatarCrop(SetAvatarRequest request)
    {
        if (!double.IsFinite(request.CropOffsetX) ||
            !double.IsFinite(request.CropOffsetY) ||
            !double.IsFinite(request.CropZoom))
        {
            throw new InvalidUserProfileDataException(
                ExceptionMessages.AvatarCropIsInvalid);
        }

        request.CropOffsetX = Math.Clamp(request.CropOffsetX, -1, 1);
        request.CropOffsetY = Math.Clamp(request.CropOffsetY, -1, 1);
        request.CropZoom = Math.Clamp(request.CropZoom, 0.5, 3);
    }

    private static SetAvatarRequest ParseAvatarCrop(
        UploadProfileAssetRequest request)
    {
        return new SetAvatarRequest
        {
            CropOffsetX = ParseFormDouble(request.CropOffsetX, 0),
            CropOffsetY = ParseFormDouble(request.CropOffsetY, 0),
            CropZoom = ParseFormDouble(request.CropZoom, 1)
        };
    }

    private static double ParseFormDouble(
        string? value,
        double defaultValue)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return defaultValue;
        }

        if (double.TryParse(
                value,
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out var parsed) ||
            double.TryParse(
                value,
                NumberStyles.Float,
                CultureInfo.CurrentCulture,
                out parsed))
        {
            return parsed;
        }

        throw new InvalidUserProfileDataException(
            ExceptionMessages.AvatarCropIsInvalid);
    }

    private bool IsOptimizedAvatar(Asset asset)
    {
        return string.Equals(
                   asset.MimeType,
                   "image/webp",
                   StringComparison.OrdinalIgnoreCase) &&
               asset.Width == this._avatarImageProcessor.OutputSizePixels &&
               asset.Height == this._avatarImageProcessor.OutputSizePixels;
    }

    private static bool IsNeutralCrop(SetAvatarRequest request)
    {
        const double epsilon = 0.000001;

        return Math.Abs(request.CropOffsetX) < epsilon &&
               Math.Abs(request.CropOffsetY) < epsilon &&
               Math.Abs(request.CropZoom - 1) < epsilon;
    }

    private async Task DeleteCompensatingAssetAsync(
        Guid userId,
        Guid assetId)
    {
        try
        {
            await this._assetService.DeleteOwnedAssetAsync(
                userId,
                assetId,
                CancellationToken.None);
        }
        catch (Exception exception)
        {
            this._logger.LogError(
                exception,
                "Failed to compensate profile asset {AssetId} for user {UserId}.",
                assetId,
                userId);
        }
    }
}
