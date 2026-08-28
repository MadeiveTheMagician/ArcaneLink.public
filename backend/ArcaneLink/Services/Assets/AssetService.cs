using System.Security.Cryptography;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.AssetExceptions;
using ArcaneLink.Observability;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Assets.Storage.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Assets
{
    public class AssetService : IAssetService
    {
        private readonly AppDbContext _db;
        private readonly IAssetStorageService _assetStorageService;
        private readonly IAssetAccessPolicy _assetAccessPolicy;
        private readonly IRealtimeNotificationService _realtime;
        private readonly AssetUploadOptions _uploadOptions;
        private readonly ILogger<AssetService> _logger;

        public AssetService(
            AppDbContext db,
            IAssetStorageService assetStorageService,
            IAssetAccessPolicy assetAccessPolicy,
            IRealtimeNotificationService realtime,
            IOptions<AssetUploadOptions> uploadOptions,
            ILogger<AssetService> logger)
        {
            this._db = db;
            this._assetStorageService = assetStorageService;
            this._assetAccessPolicy = assetAccessPolicy;
            this._realtime = realtime;
            this._uploadOptions = uploadOptions.Value;
            this._logger = logger;
        }

        public Task<AssetResponse> UploadAssetAsync(
            Guid ownerUserId,
            UploadAssetRequest request,
            CancellationToken cancellationToken = default)
        {
            return this.UploadImageAssetAsync(
                ownerUserId,
                request,
                width: null,
                height: null,
                cancellationToken);
        }

        public Task<AssetResponse> UploadOptimizedAvatarAsync(
            Guid ownerUserId,
            IFormFile file,
            int sizePixels,
            CancellationToken cancellationToken = default)
        {
            if (sizePixels <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(sizePixels));
            }

            return this.UploadImageAssetAsync(
                ownerUserId,
                new UploadAssetRequest
                {
                    AssetTypeId = AssetTypeIds.CurrentAvatar,
                    File = file
                },
                sizePixels,
                sizePixels,
                cancellationToken);
        }

        private async Task<AssetResponse> UploadImageAssetAsync(
            Guid ownerUserId,
            UploadAssetRequest request,
            int? width,
            int? height,
            CancellationToken cancellationToken)
        {
            try
            {
                this.ValidateUploadRequest(request);
            }
            catch (InvalidAssetDataException exception)
            {
                this.LogAssetUploadRejected(ownerUserId, request.File?.FileName, request.File?.ContentType, request.File?.Length, exception.Message);
                throw;
            }

            var assetType = await this.GetAssetTypeAsync(
                request.AssetTypeId,
                cancellationToken);

            if (assetType.Id == AssetTypeIds.ProfileBackground)
            {
                await this.EnsureCanUploadProfileBackgroundAsync(
                    ownerUserId,
                    cancellationToken);
            }
            else if (assetType.Id == AssetTypeIds.Banner)
            {
                await this.EnsureCanUploadProfileBannerAsync(
                    ownerUserId,
                    cancellationToken);
            }

            await using var inputStream = request.File.OpenReadStream();
            await using var buffer = new MemoryStream();
            await inputStream.CopyToAsync(buffer, cancellationToken);
            var inspectedFileType = ValidateTrustedFileType(
                buffer,
                this._uploadOptions.AllowedImageMimeTypes);

            buffer.Position = 0;
            var sha256 = Convert.ToHexString(
                await SHA256.HashDataAsync(buffer, cancellationToken));

            var assetId = Guid.NewGuid();

            var storageResult = await this._assetStorageService.SaveAsync(
                assetId,
                ownerUserId,
                assetType.Code,
                inspectedFileType.Extension,
                buffer,
                cancellationToken);

            var asset = new Asset
            {
                Id = assetId,
                OwnerUserId = ownerUserId,
                AssetTypeId = assetType.Id,
                AssetType = assetType,
                StorageKey = storageResult.StorageKey,
                OriginalFileName = SanitizeFileName(request.File.FileName),
                MimeType = inspectedFileType.MimeType,
                SizeBytes = request.File.Length,
                Sha256 = sha256,
                Width = width,
                Height = height,
                CreatedAt = DateTime.UtcNow
            };

            this._db.Assets.Add(asset);
            try
            {
                await this._db.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                this._db.Entry(asset).State = EntityState.Detached;
                try
                {
                    await this._assetStorageService.DeleteAsync(
                        storageResult.StorageKey,
                        CancellationToken.None);
                }
                catch (Exception cleanupException)
                {
                    this._logger.LogError(
                        cleanupException,
                        "Failed to compensate stored asset {AssetId} after metadata save failure.",
                        assetId);
                }

                throw;
            }
            await this.NotifyOwnerAssetsChangedAsync(asset, cancellationToken);

            return ToResponse(asset);
        }

        public async Task<AssetResponse> UploadMessageAttachmentAsync(
            Guid ownerUserId,
            IFormFile file,
            CancellationToken cancellationToken = default)
        {
            var subscriptionPlan = await this.GetOwnerSubscriptionPlanAsync(
                ownerUserId,
                cancellationToken);

            try
            {
                this.ValidateAttachmentUpload(file, subscriptionPlan);
            }
            catch (InvalidAssetDataException exception)
            {
                this.LogAssetUploadRejected(ownerUserId, file?.FileName, file?.ContentType, file?.Length, exception.Message);
                throw;
            }

            var assetType = await this.GetAssetTypeAsync(
                AssetTypeIds.MessageAttachment,
                cancellationToken);

            await using var inputStream = file.OpenReadStream();
            await using var buffer = new MemoryStream();
            await inputStream.CopyToAsync(buffer, cancellationToken);
            var attachmentFileType = ResolveAttachmentFileType(
                buffer,
                file.FileName);

            buffer.Position = 0;
            var sha256 = Convert.ToHexString(
                await SHA256.HashDataAsync(buffer, cancellationToken));

            var assetId = Guid.NewGuid();
            var storageResult = await this._assetStorageService.SaveAsync(
                assetId,
                ownerUserId,
                assetType.Code,
                attachmentFileType.Extension,
                buffer,
                cancellationToken);

            var asset = new Asset
            {
                Id = assetId,
                OwnerUserId = ownerUserId,
                AssetTypeId = assetType.Id,
                AssetType = assetType,
                StorageKey = storageResult.StorageKey,
                OriginalFileName = SanitizeFileName(file.FileName),
                MimeType = attachmentFileType.MimeType,
                SizeBytes = file.Length,
                Sha256 = sha256,
                Width = null,
                Height = null,
                CreatedAt = DateTime.UtcNow
            };

            this._db.Assets.Add(asset);
            await this._db.SaveChangesAsync(cancellationToken);
            await this.NotifyOwnerAssetsChangedAsync(asset, cancellationToken);

            return ToResponse(asset);
        }

        public async Task<AssetResponse?> GetReadableAssetAsync(
            Guid? currentUserId,
            Guid assetId,
            CancellationToken cancellationToken = default)
        {
            var asset = await this._db.Assets
                .AsNoTracking()
                .Include(x => x.AssetType)
                .FirstOrDefaultAsync(
                    x => x.Id == assetId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (asset == null ||
                await this._assetAccessPolicy.GetReadScopeAsync(
                    currentUserId,
                    asset,
                    cancellationToken) == AssetReadScope.Denied)
            {
                return null;
            }

            return ToResponse(asset);
        }

        public async Task<IReadOnlyList<AssetResponse>> GetOwnedAssetsAsync(
            Guid ownerUserId,
            Guid? assetTypeId = null,
            CancellationToken cancellationToken = default)
        {
            var query = this._db.Assets
                .AsNoTracking()
                .Include(x => x.AssetType)
                .Where(x => x.OwnerUserId == ownerUserId &&
                            x.DeletedAt == null);

            if (assetTypeId != null)
            {
                query = query.Where(x => x.AssetTypeId == assetTypeId.Value);
            }

            var assets = await query
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return assets
                .Select(ToResponse)
                .ToList();
        }

        public async Task<AssetContentResponse?> GetReadableAssetContentAsync(
            Guid? currentUserId,
            Guid assetId,
            CancellationToken cancellationToken = default)
        {
            return await this.GetAssetContentCoreAsync(
                assetId,
                currentUserId,
                enforceReadPolicy: true,
                allowSoftDeleted: false,
                cancellationToken);
        }

        public async Task<AssetContentResponse?> GetAssetContentAsync(
            Guid assetId,
            CancellationToken cancellationToken = default)
        {
            return await this.GetAssetContentCoreAsync(
                assetId,
                currentUserId: null,
                enforceReadPolicy: false,
                allowSoftDeleted: false,
                cancellationToken);
        }

        public async Task<AssetContentResponse?> GetRetainedAssetContentAsync(
            Guid assetId,
            CancellationToken cancellationToken = default)
        {
            return await this.GetAssetContentCoreAsync(
                assetId,
                currentUserId: null,
                enforceReadPolicy: false,
                allowSoftDeleted: true,
                cancellationToken);
        }

        private async Task<AssetContentResponse?> GetAssetContentCoreAsync(
            Guid assetId,
            Guid? currentUserId,
            bool enforceReadPolicy,
            bool allowSoftDeleted,
            CancellationToken cancellationToken)
        {
            var asset = await this._db.Assets
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == assetId &&
                         (allowSoftDeleted || x.DeletedAt == null) &&
                         x.PhysicalDeletedAt == null,
                    cancellationToken);

            if (asset == null)
            {
                return null;
            }

            var readScope = asset.AssetTypeId == AssetTypeIds.MessageAttachment
                ? AssetReadScope.Private
                : AssetReadScope.Public;
            if (enforceReadPolicy)
            {
                readScope = await this._assetAccessPolicy.GetReadScopeAsync(
                    currentUserId,
                    asset,
                    cancellationToken);
                if (readScope == AssetReadScope.Denied)
                {
                    return null;
                }
            }

            var storageResult = await this._assetStorageService.OpenReadAsync(
                asset.StorageKey,
                cancellationToken);

            if (storageResult == null)
            {
                return null;
            }

            return new AssetContentResponse
            {
                Content = storageResult.Content,
                MimeType = asset.MimeType,
                FileName = asset.OriginalFileName ?? Path.GetFileName(asset.StorageKey),
                Sha256 = asset.Sha256,
                CreatedAt = asset.CreatedAt,
                IsSafeInline = IsSafeInlineMimeType(asset.MimeType),
                IsPubliclyCacheable = readScope == AssetReadScope.Public
            };
        }

        public async Task<OwnedAssetDeleteResult> DeleteOwnedAssetAsync(
            Guid ownerUserId,
            Guid assetId,
            CancellationToken cancellationToken = default)
        {
            var asset = await this._db.Assets
                .FirstOrDefaultAsync(
                    x => x.Id == assetId &&
                         x.OwnerUserId == ownerUserId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (asset == null)
            {
                return OwnedAssetDeleteResult.NotFound;
            }

            var isManagedByDomain =
                await this._db.ServerMemberProfiles.AsNoTracking().AnyAsync(
                    profile =>
                        profile.AvatarAssetId == asset.Id ||
                        profile.AvatarSourceAssetId == asset.Id ||
                        profile.BannerAssetId == asset.Id,
                    cancellationToken) ||
                await this._db.Servers.AsNoTracking().AnyAsync(
                    server => server.IconAssetId == asset.Id,
                    cancellationToken) ||
                await this._db.SpaceMessageAssets.AsNoTracking().AnyAsync(
                    attachment => attachment.AssetId == asset.Id,
                    cancellationToken);
            if (isManagedByDomain)
            {
                return OwnedAssetDeleteResult.ManagedByDomain;
            }

            var profilesUsingAvatar = await this._db.UserProfiles
                .Where(x => x.AvatarAssetId == asset.Id)
                .ToListAsync(cancellationToken);

            foreach (var profile in profilesUsingAvatar)
            {
                profile.AvatarAssetId = null;
                profile.AvatarSourceAssetId = null;
                profile.AvatarCropOffsetX = 0;
                profile.AvatarCropOffsetY = 0;
                profile.AvatarCropZoom = 1;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var profilesUsingAvatarSource = await this._db.UserProfiles
                .Where(x => x.AvatarSourceAssetId == asset.Id)
                .ToListAsync(cancellationToken);

            foreach (var profile in profilesUsingAvatarSource)
            {
                profile.AvatarSourceAssetId = null;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var profilesUsingBanner = await this._db.UserProfiles
                .Where(x => x.BannerAssetId == asset.Id)
                .ToListAsync(cancellationToken);

            foreach (var profile in profilesUsingBanner)
            {
                profile.BannerAssetId = null;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var serverProfilesUsingAvatar = await this._db.ServerMemberProfiles
                .Where(x => x.AvatarAssetId == asset.Id)
                .ToListAsync(cancellationToken);
            foreach (var profile in serverProfilesUsingAvatar)
            {
                profile.AvatarAssetId = null;
                profile.AvatarSourceAssetId = null;
                profile.AvatarCropOffsetX = 0;
                profile.AvatarCropOffsetY = 0;
                profile.AvatarCropZoom = 1;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var serverProfilesUsingAvatarSource = await this._db.ServerMemberProfiles
                .Where(x => x.AvatarSourceAssetId == asset.Id)
                .ToListAsync(cancellationToken);
            foreach (var profile in serverProfilesUsingAvatarSource)
            {
                profile.AvatarSourceAssetId = null;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var serverProfilesUsingBanner = await this._db.ServerMemberProfiles
                .Where(x => x.BannerAssetId == asset.Id)
                .ToListAsync(cancellationToken);
            foreach (var profile in serverProfilesUsingBanner)
            {
                profile.BannerAssetId = null;
                profile.UpdatedAt = DateTime.UtcNow;
            }

            var affectedServerProfiles = serverProfilesUsingAvatar
                .Concat(serverProfilesUsingAvatarSource)
                .Concat(serverProfilesUsingBanner)
                .GroupBy(profile => profile.ServerMemberId)
                .Select(group => group.First())
                .ToList();
            var affectedServerMemberIds = affectedServerProfiles
                .Select(profile => profile.ServerMemberId)
                .ToArray();
            var affectedServerMembers = affectedServerMemberIds.Length == 0
                ? new List<ServerMember>()
                : await this._db.ServerMembers
                    .Where(member => affectedServerMemberIds.Contains(member.Id))
                    .ToListAsync(cancellationToken);
            var serverProfileChangedAt = DateTime.UtcNow;
            foreach (var member in affectedServerMembers)
            {
                member.UpdatedAt = serverProfileChangedAt;
            }
            foreach (var profile in affectedServerProfiles)
            {
                if (!HasServerProfileOverrides(profile))
                {
                    this._db.ServerMemberProfiles.Remove(profile);
                }
            }

            var serversUsingIcon = await this._db.Servers
                .Where(x => x.IconAssetId == asset.Id)
                .ToListAsync(cancellationToken);

            foreach (var server in serversUsingIcon)
            {
                server.IconAssetId = null;
                server.IconCropOffsetX = 0;
                server.IconCropOffsetY = 0;
                server.IconCropZoom = 1;
                server.UpdatedAt = DateTime.UtcNow;
            }

            var privateMembersUsingPeerAvatar = await this._db.PrivateSpaceMembers
                .Where(member => member.PeerAvatarAssetId == asset.Id)
                .ToListAsync(cancellationToken);
            foreach (var member in privateMembersUsingPeerAvatar)
            {
                member.PeerAvatarAssetId = null;
                member.PeerAvatarCropOffsetX = 0;
                member.PeerAvatarCropOffsetY = 0;
                member.PeerAvatarCropZoom = 1;
                member.UpdatedAt = DateTime.UtcNow;
            }

            var groupsUsingAvatar = await this._db.PrivateSpaces
                .Where(space => space.AvatarAssetId == asset.Id)
                .ToListAsync(cancellationToken);
            foreach (var privateSpace in groupsUsingAvatar)
            {
                privateSpace.AvatarAssetId = null;
                privateSpace.AvatarCropOffsetX = 0;
                privateSpace.AvatarCropOffsetY = 0;
                privateSpace.AvatarCropZoom = 1;
                privateSpace.UpdatedAt = DateTime.UtcNow;
            }

            var isHeldByModerationEvidence = await this._db.ModerationEvidenceAssets
                .AsNoTracking()
                .AnyAsync(x => x.AssetId == asset.Id, cancellationToken);

            asset.DeletedAt = DateTime.UtcNow;

            await this._db.SaveChangesAsync(cancellationToken);

            foreach (var member in privateMembersUsingPeerAvatar)
            {
                await this._realtime.NotifyUserBestEffortAsync(
                    this._logger,
                    member.UserId,
                    RealtimeEventNames.PrivateSpacesChanged,
                    new { spaceId = member.SpaceId },
                    CancellationToken.None);
            }
            foreach (var privateSpace in groupsUsingAvatar)
            {
                var recipientUserIds = await this._db.PrivateSpaceMembers
                    .AsNoTracking()
                    .Where(member =>
                        member.SpaceId == privateSpace.SpaceId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                    .Select(member => member.UserId)
                    .ToArrayAsync(CancellationToken.None);
                await this._realtime.NotifyUsersBestEffortAsync(
                    this._logger,
                    recipientUserIds,
                    RealtimeEventNames.PrivateSpacesChanged,
                    new { spaceId = privateSpace.SpaceId },
                    CancellationToken.None);
            }

            try
            {
                if (!isHeldByModerationEvidence)
                {
                    await this._assetStorageService.DeleteAsync(
                        asset.StorageKey,
                        cancellationToken);
                    asset.PhysicalDeletedAt = DateTime.UtcNow;
                    await this._db.SaveChangesAsync(cancellationToken);
                }
            }
            catch (Exception exception)
            {
                ArcaneLinkDiagnostics.AssetPhysicalDeleteFailedCounter.Add(1);
                this._logger.LogError(
                    ObservabilityEventIds.AssetPhysicalDeleteFailed,
                    exception,
                    "Failed to delete asset bytes. AssetId={AssetId} StorageKey={StorageKey}",
                    asset.Id,
                    asset.StorageKey);
            }

            await this.NotifyOwnerAssetsChangedAsync(asset, cancellationToken);
            foreach (var userId in profilesUsingAvatar
                         .Concat(profilesUsingBanner)
                         .Select(x => x.UserId)
                         .Distinct())
            {
                await this._realtime.NotifyUserAsync(
                    userId,
                    RealtimeEventNames.UserProfileChanged,
                    new { userId, assetId = asset.Id },
                    cancellationToken);
            }

            foreach (var serverId in serversUsingIcon.Select(x => x.Id).Distinct())
            {
                await this._realtime.NotifyServerAsync(
                    serverId,
                    RealtimeEventNames.ServerUpdated,
                    new { serverId, assetId = asset.Id },
                    cancellationToken);
                await this._realtime.NotifyServerAsync(
                    serverId,
                    RealtimeEventNames.ServerMembersChanged,
                    new { serverId, assetId = asset.Id },
                    cancellationToken);
            }


            foreach (var serverId in affectedServerMembers
                         .Select(member => member.ServerId)
                         .Distinct())
            {
                await this._realtime.NotifyServerAsync(
                    serverId,
                    RealtimeEventNames.ServerMembersChanged,
                    new { serverId, assetId = asset.Id },
                    cancellationToken);
            }

            return OwnedAssetDeleteResult.Deleted;
        }

        private static bool HasServerProfileOverrides(
            ServerMemberProfile profile)
        {
            return profile.DisplayName != null ||
                   profile.AvatarAssetId.HasValue ||
                   profile.BannerAssetId.HasValue ||
                   profile.About != null ||
                   profile.StatusText != null;
        }

        private async Task NotifyOwnerAssetsChangedAsync(
            Asset asset,
            CancellationToken cancellationToken)
        {
            if (asset.OwnerUserId == null)
            {
                return;
            }

            await this._realtime.NotifyUserBestEffortAsync(
                this._logger,
                asset.OwnerUserId.Value,
                RealtimeEventNames.UserAssetsChanged,
                new { assetId = asset.Id, assetTypeId = asset.AssetTypeId },
                CancellationToken.None);
        }

        private async Task<AssetType> GetAssetTypeAsync(
            Guid assetTypeId,
            CancellationToken cancellationToken)
        {
            return await this._db.AssetTypes
                .FirstOrDefaultAsync(
                    x => x.Id == assetTypeId,
                    cancellationToken)
                ?? throw new AssetTypeDoesNotExistException();
        }

        private async Task EnsureCanUploadProfileBackgroundAsync(
            Guid ownerUserId,
            CancellationToken cancellationToken)
        {
            var currentCount = await this._db.Assets.CountAsync(
                x => x.OwnerUserId == ownerUserId &&
                     x.AssetTypeId == AssetTypeIds.ProfileBackground &&
                     x.DeletedAt == null,
                cancellationToken);
            var subscriptionPlan = await this.GetOwnerSubscriptionPlanAsync(
                ownerUserId,
                cancellationToken);

            if (currentCount >= this._uploadOptions.GetProfileBackgroundAssetLimit(subscriptionPlan))
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.ProfileBackgroundAssetCountIsTooLarge);
            }
        }

        private async Task EnsureCanUploadProfileBannerAsync(
            Guid ownerUserId,
            CancellationToken cancellationToken)
        {
            var currentCount = await this._db.Assets.CountAsync(
                asset =>
                    asset.OwnerUserId == ownerUserId &&
                    asset.AssetTypeId == AssetTypeIds.Banner &&
                    asset.DeletedAt == null,
                cancellationToken);

            if (currentCount >= this._uploadOptions.MaxProfileBannerAssets)
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.ProfileBannerAssetCountIsTooLarge);
            }
        }

        private async Task<string> GetOwnerSubscriptionPlanAsync(
            Guid ownerUserId,
            CancellationToken cancellationToken)
        {
            return await this._db.Users
                .AsNoTracking()
                .Where(x => x.Id == ownerUserId)
                .Select(x => x.SubscriptionType.Code)
                .FirstOrDefaultAsync(cancellationToken) ?? "free";
        }

        private void ValidateUploadRequest(UploadAssetRequest request)
        {
            if (request.File == null || request.File.Length == 0)
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetFileIsRequired);
            }

            if (request.File.Length > this._uploadOptions.MaxImageUploadSizeBytes)
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetFileIsTooLarge);
            }
        }

        private void LogAssetUploadRejected(
            Guid ownerUserId,
            string? fileName,
            string? contentType,
            long? sizeBytes,
            string reason)
        {
            ArcaneLinkDiagnostics.AssetUploadRejectedCounter.Add(1);
            this._logger.LogWarning(
                ObservabilityEventIds.AssetUploadRejected,
                "Asset upload rejected. OwnerUserId={OwnerUserId} FileName={FileName} ContentType={ContentType} SizeBytes={SizeBytes} Reason={Reason}",
                ownerUserId,
                fileName,
                contentType,
                sizeBytes,
                reason);
        }

        private void ValidateAttachmentUpload(IFormFile file, string subscriptionPlan)
        {
            if (file == null || file.Length == 0)
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetFileIsRequired);
            }

            if (file.Length > this._uploadOptions.GetAttachmentUploadLimitBytes(subscriptionPlan))
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetFileIsTooLarge);
            }
        }

        private static InspectedFileType ValidateTrustedFileType(
            MemoryStream buffer,
            IReadOnlyCollection<string> allowedMimeTypes)
        {
            var inspectedFileType = FileTypeInspector.Inspect(buffer.ToArray());

            if (inspectedFileType == null)
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetFileSignatureIsInvalid);
            }

            if (!allowedMimeTypes.Contains(
                    inspectedFileType.MimeType,
                    StringComparer.OrdinalIgnoreCase))
            {
                throw new InvalidAssetDataException(
                    ExceptionMessages.AssetMimeTypeIsNotAllowed);
            }

            return inspectedFileType;
        }

        private static InspectedFileType ResolveAttachmentFileType(
            MemoryStream buffer,
            string fileName)
        {
            var inspectedFileType = FileTypeInspector.Inspect(buffer.ToArray());
            if (inspectedFileType != null)
            {
                return inspectedFileType;
            }

            return new InspectedFileType(
                "application/octet-stream",
                GetSafeFileExtension(fileName),
                false);
        }

        private static string GetSafeFileExtension(string fileName)
        {
            var extension = Path.GetExtension(fileName);

            if (string.IsNullOrWhiteSpace(extension) ||
                extension.Length > 32 ||
                extension.Any(Path.GetInvalidFileNameChars().Contains))
            {
                return ".bin";
            }

            return extension.ToLowerInvariant();
        }

        private static bool IsSafeInlineMimeType(string mimeType)
        {
            return mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ||
                   mimeType.StartsWith("video/", StringComparison.OrdinalIgnoreCase);
        }

        private static string? SanitizeFileName(string? fileName)
        {
            var normalized = Path.GetFileName(fileName);

            if (string.IsNullOrWhiteSpace(normalized))
            {
                return null;
            }

            foreach (var invalidChar in Path.GetInvalidFileNameChars())
            {
                normalized = normalized.Replace(invalidChar, '_');
            }

            return normalized.Length <= 255
                ? normalized
                : normalized[..255];
        }

        private static AssetResponse ToResponse(Asset asset)
        {
            return new AssetResponse
            {
                Id = asset.Id,
                OwnerUserId = asset.OwnerUserId,
                AssetTypeId = asset.AssetTypeId,
                AssetTypeCode = asset.AssetType.Code,
                OriginalFileName = asset.OriginalFileName,
                MimeType = asset.MimeType,
                SizeBytes = asset.SizeBytes,
                Sha256 = asset.Sha256,
                Width = asset.Width,
                Height = asset.Height,
                CreatedAt = asset.CreatedAt
            };
        }
    }
}
