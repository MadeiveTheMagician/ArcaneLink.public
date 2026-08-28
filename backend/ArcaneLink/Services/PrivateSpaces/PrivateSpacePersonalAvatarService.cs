using System.Globalization;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.AssetExceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.PrivateSpaces;

public sealed class PrivateSpacePersonalAvatarService
{
    private readonly AppDbContext _db;
    private readonly IAssetService _assets;
    private readonly AvatarImageProcessor _processor;
    private readonly PrivateSpaceRealtimeNotifier _notifier;
    private readonly AssetUploadOptions _uploadOptions;
    private readonly TimeProvider _timeProvider;

    public PrivateSpacePersonalAvatarService(
        AppDbContext db,
        IAssetService assets,
        AvatarImageProcessor processor,
        PrivateSpaceRealtimeNotifier notifier,
        IOptions<AssetUploadOptions> uploadOptions,
        TimeProvider timeProvider)
    {
        this._db = db;
        this._assets = assets;
        this._processor = processor;
        this._notifier = notifier;
        this._uploadOptions = uploadOptions.Value;
        this._timeProvider = timeProvider;
    }

    public async Task<bool> UploadAsync(
        Guid currentUserId,
        Guid spaceId,
        UploadPrivateSpacePersonalAvatarRequest request,
        CancellationToken cancellationToken = default)
    {
        var membership = await this._db.PrivateSpaceMembers
            .Include(member => member.PrivateSpace)
                .ThenInclude(privateSpace => privateSpace.Space)
            .FirstOrDefaultAsync(
                member =>
                    member.SpaceId == spaceId &&
                    member.UserId == currentUserId &&
                    member.StatusId ==
                    PrivateSpaceIds.MemberStatusActive &&
                    member.PrivateSpace.DeletedAt == null &&
                    member.PrivateSpace.Space.DeletedAt == null,
                cancellationToken);
        if (membership == null)
        {
            return false;
        }

        this.ValidateFile(request.File);
        var crop = ParseCrop(request);
        await using var source = request.File.OpenReadStream();
        await using var optimizedContent = await this._processor.ProcessAsync(
            source,
            crop.OffsetX,
            crop.OffsetY,
            crop.Zoom,
            cancellationToken);

        Guid? uploadedAssetId = null;
        var assignmentSaved = false;
        try
        {
            uploadedAssetId = await this.UploadOptimizedAssetAsync(
                currentUserId,
                request.File.FileName,
                optimizedContent,
                cancellationToken);
            var previousAssetId = membership.PeerAvatarAssetId;
            membership.PeerAvatarAssetId = uploadedAssetId;
            membership.PeerAvatarCropOffsetX = 0;
            membership.PeerAvatarCropOffsetY = 0;
            membership.PeerAvatarCropZoom = 1;
            membership.UpdatedAt =
                this._timeProvider.GetUtcNow().UtcDateTime;
            await this._db.SaveChangesAsync(cancellationToken);
            assignmentSaved = true;

            if (previousAssetId.HasValue &&
                previousAssetId != uploadedAssetId)
            {
                await this.DeleteOwnedOptimizedIfOrphanedAsync(
                    currentUserId,
                    previousAssetId.Value,
                    CancellationToken.None);
            }

            await this._notifier.NotifySpacesChangedForUserAsync(
                currentUserId,
                spaceId,
                CancellationToken.None);
            return true;
        }
        catch
        {
            if (!assignmentSaved && uploadedAssetId.HasValue)
            {
                await this._assets.DeleteOwnedAssetAsync(
                    currentUserId,
                    uploadedAssetId.Value,
                    CancellationToken.None);
            }

            throw;
        }
    }

    public async Task DeleteOwnedOptimizedIfOrphanedAsync(
        Guid ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken = default)
    {
        await OptimizedAvatarAssetCleanup.DeleteOwnedIfOrphanedAsync(
            this._db,
            this._assets,
            ownerUserId,
            assetId,
            cancellationToken);
    }

    private async Task<Guid> UploadOptimizedAssetAsync(
        Guid ownerUserId,
        string? sourceFileName,
        MemoryStream content,
        CancellationToken cancellationToken)
    {
        var baseName = Path.GetFileNameWithoutExtension(sourceFileName);
        var fileName =
            $"{(string.IsNullOrWhiteSpace(baseName) ? "avatar" : baseName)}.webp";
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
        var asset = await this._assets.UploadAssetAsync(
            ownerUserId,
            new UploadAssetRequest
            {
                AssetTypeId = AssetTypeIds.CurrentAvatar,
                File = formFile
            },
            cancellationToken);
        var storedAsset = await this._db.Assets.FirstAsync(
            item => item.Id == asset.Id,
            cancellationToken);
        storedAsset.Width = this._processor.OutputSizePixels;
        storedAsset.Height = this._processor.OutputSizePixels;
        await this._db.SaveChangesAsync(cancellationToken);
        return asset.Id;
    }

    private void ValidateFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            throw new InvalidAssetDataException(
                ExceptionMessages.AssetFileIsRequired);
        }
        if (file.Length > this._uploadOptions.MaxImageUploadSizeBytes)
        {
            throw new InvalidAssetDataException(
                ExceptionMessages.AssetFileIsTooLarge);
        }
    }

    private static AvatarCrop ParseCrop(
        UploadPrivateSpacePersonalAvatarRequest request)
    {
        var crop = new AvatarCrop(
            ParseFormDouble(request.CropOffsetX, 0),
            ParseFormDouble(request.CropOffsetY, 0),
            ParseFormDouble(request.CropZoom, 1));
        if (!double.IsFinite(crop.OffsetX) ||
            !double.IsFinite(crop.OffsetY) ||
            !double.IsFinite(crop.Zoom))
        {
            throw InvalidCrop();
        }

        return new AvatarCrop(
            Math.Clamp(crop.OffsetX, -1, 1),
            Math.Clamp(crop.OffsetY, -1, 1),
            Math.Clamp(crop.Zoom, 0.5, 3));
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

        throw InvalidCrop();
    }

    private static InvalidUserProfileDataException InvalidCrop() =>
        new(ExceptionMessages.AvatarCropIsInvalid);

    private readonly record struct AvatarCrop(
        double OffsetX,
        double OffsetY,
        double Zoom);
}
