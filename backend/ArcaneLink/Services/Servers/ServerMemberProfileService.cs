using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers;

public sealed class ServerMemberProfileService : IServerMemberProfileService
{
    private const int MutualPreviewLimit = 24;
    private const string DefaultProfileThemeCode = "sapphire";

    private readonly AppDbContext _db;
    private readonly IAssetService _assets;
    private readonly AvatarImageProcessor _avatarImageProcessor;
    private readonly IRealtimeNotificationService _realtime;
    private readonly IServerGovernanceAccessService _access;
    private readonly ILogger<ServerMemberProfileService> _logger;

    public ServerMemberProfileService(
        AppDbContext db,
        IAssetService assets,
        AvatarImageProcessor avatarImageProcessor,
        IRealtimeNotificationService realtime,
        IServerGovernanceAccessService access,
        ILogger<ServerMemberProfileService> logger)
    {
        this._db = db;
        this._assets = assets;
        this._avatarImageProcessor = avatarImageProcessor;
        this._realtime = realtime;
        this._access = access;
        this._logger = logger;
    }

    public async Task<ServerMemberViewerProfileResponse?> GetAsync(
        Guid currentUserId,
        Guid serverId,
        Guid targetUserId,
        CancellationToken cancellationToken = default)
    {
        if (!await this.IsActiveMemberAsync(
                currentUserId,
                serverId,
                cancellationToken))
        {
            return null;
        }

        var member = await this.LoadActiveMemberAsync(
            serverId,
            targetUserId,
            tracking: false,
            cancellationToken);
        if (member == null)
        {
            return null;
        }

        var response = ToViewerResponse(member);
        if (currentUserId != targetUserId)
        {
            await this.PopulateMutualContextAsync(
                response,
                currentUserId,
                targetUserId,
                cancellationToken);
        }
        return response;
    }

    public async Task<OwnServerMemberProfileResponse?> GetOwnAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        if (!await this.IsActiveMemberAsync(
                currentUserId,
                serverId,
                cancellationToken))
        {
            return null;
        }

        var member = await this.LoadActiveMemberAsync(
            serverId,
            currentUserId,
            tracking: false,
            cancellationToken);
        return member == null ? null : ToOwnResponse(member);
    }

    public async Task<OwnServerMemberProfileResponse?> UpdateOwnAsync(
        Guid currentUserId,
        Guid serverId,
        UpdateServerMemberProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.DisplayName != null &&
            !request.UseGlobalDisplayName &&
            !await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "CHANGE_OWN_NICKNAME",
                cancellationToken))
        {
            return null;
        }

        var member = await this.LoadActiveMemberAsync(
            serverId,
            currentUserId,
            tracking: true,
            cancellationToken);
        if (member == null)
        {
            return null;
        }

        ValidatePatchAvatarFields(request);

        var profile = member.ServerProfile;
        if (profile == null && !RequiresStoredProfile(request))
        {
            return ToOwnResponse(member);
        }

        if (profile == null)
        {
            profile = new ServerMemberProfile
            {
                ServerMemberId = member.Id,
                UpdatedAt = DateTime.UtcNow
            };
            member.ServerProfile = profile;
            this._db.ServerMemberProfiles.Add(profile);
        }

        var previousOptimizedAvatarId = profile.AvatarAssetId;

        if (request.UseGlobalDisplayName)
        {
            profile.DisplayName = null;
            profile.DisplayNameNorm = null;
        }
        else if (request.DisplayName != null)
        {
            var displayName = request.DisplayName.Trim();
            if (displayName.Length == 0)
            {
                throw new InvalidUserProfileDataException();
            }

            profile.DisplayName = displayName;
            profile.DisplayNameNorm = displayName.ToUpperInvariant();
        }

        if (request.UseGlobalAvatar)
        {
            ResetAvatar(profile);
        }

        if (request.UseGlobalBanner)
        {
            profile.BannerAssetId = null;
        }
        else if (request.BannerAssetId.HasValue)
        {
            var banner = await this.GetOwnedAssetAsync(
                currentUserId,
                request.BannerAssetId.Value,
                cancellationToken);
            if (banner?.AssetTypeId != AssetTypeIds.Banner)
            {
                if (banner == null)
                {
                    return null;
                }

                throw new InvalidUserProfileDataException(
                    ExceptionMessages.ProfileBannerAssetTypeIsInvalid);
            }

            profile.BannerAssetId = banner.Id;
        }

        if (request.UseGlobalAbout)
        {
            profile.About = null;
        }
        else if (request.About != null)
        {
            profile.About = NormalizeOptional(request.About);
        }

        if (request.ClearStatusText)
        {
            profile.StatusText = null;
        }
        else if (request.StatusText != null)
        {
            profile.StatusText = NormalizeOptional(request.StatusText);
        }

        var now = DateTime.UtcNow;
        profile.UpdatedAt = now;
        member.UpdatedAt = now;
        if (!HasOverrides(profile))
        {
            this._db.ServerMemberProfiles.Remove(profile);
            member.ServerProfile = null;
        }

        await this._db.SaveChangesAsync(cancellationToken);
        if (request.UseGlobalAvatar &&
            previousOptimizedAvatarId.HasValue)
        {
            await OptimizedAvatarAssetCleanup.DeleteOwnedIfOrphanedAsync(
                this._db,
                this._assets,
                currentUserId,
                previousOptimizedAvatarId.Value,
                CancellationToken.None);
        }
        await this.NotifyChangedAsync(serverId, currentUserId, cancellationToken);
        return ToOwnResponse(member);
    }

    public async Task<OwnServerMemberProfileResponse?> SetOwnAvatarAsync(
        Guid currentUserId,
        Guid serverId,
        Guid sourceAssetId,
        SetServerMemberProfileAvatarRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateAvatarCrop(request);

        var member = await this.LoadActiveMemberAsync(
            serverId,
            currentUserId,
            tracking: true,
            cancellationToken);
        if (member == null)
        {
            return null;
        }

        var sourceAsset = await this.GetOwnedAssetAsync(
            currentUserId,
            sourceAssetId,
            cancellationToken);
        if (sourceAsset == null)
        {
            return null;
        }

        if (sourceAsset.AssetTypeId != AssetTypeIds.Avatar)
        {
            throw new InvalidUserProfileDataException(
                ExceptionMessages.ProfileAvatarAssetTypeIsInvalid);
        }

        var sourceContent = await this._assets.GetAssetContentAsync(
            sourceAsset.Id,
            cancellationToken);
        if (sourceContent == null)
        {
            return null;
        }

        await using var sourceStream = sourceContent.Content;
        await using var optimizedContent =
            await this._avatarImageProcessor.ProcessAsync(
                sourceStream,
                request.CropOffsetX,
                request.CropOffsetY,
                request.CropZoom,
                cancellationToken);
        var optimizedAssetId = await this.UploadOptimizedAvatarAssetAsync(
            currentUserId,
            optimizedContent,
            sourceAsset.OriginalFileName,
            cancellationToken);

        var previousOptimizedAvatarId = member.ServerProfile?.AvatarAssetId;
        try
        {
            var profile = member.ServerProfile;
            if (profile == null)
            {
                profile = new ServerMemberProfile
                {
                    ServerMemberId = member.Id
                };
                member.ServerProfile = profile;
                this._db.ServerMemberProfiles.Add(profile);
            }

            profile.AvatarAssetId = optimizedAssetId;
            profile.AvatarSourceAssetId = sourceAsset.Id;
            profile.AvatarCropOffsetX = request.CropOffsetX;
            profile.AvatarCropOffsetY = request.CropOffsetY;
            profile.AvatarCropZoom = request.CropZoom;

            var now = DateTime.UtcNow;
            profile.UpdatedAt = now;
            member.UpdatedAt = now;
            await this._db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await this.DeleteCompensatingAssetAsync(
                currentUserId,
                optimizedAssetId);
            throw;
        }

        if (previousOptimizedAvatarId.HasValue &&
            previousOptimizedAvatarId != optimizedAssetId)
        {
            await OptimizedAvatarAssetCleanup.DeleteOwnedIfOrphanedAsync(
                this._db,
                this._assets,
                currentUserId,
                previousOptimizedAvatarId.Value,
                CancellationToken.None);
        }

        await this.NotifyChangedAsync(
            serverId,
            currentUserId,
            cancellationToken);
        return ToOwnResponse(member);
    }

    public async Task<OwnServerMemberProfileResponse?> ResetOwnAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        var member = await this.LoadActiveMemberAsync(
            serverId,
            currentUserId,
            tracking: true,
            cancellationToken);
        if (member == null)
        {
            return null;
        }

        if (member.ServerProfile != null)
        {
            var previousOptimizedAvatarId =
                member.ServerProfile.AvatarAssetId;
            this._db.ServerMemberProfiles.Remove(member.ServerProfile);
            member.ServerProfile = null;
            member.UpdatedAt = DateTime.UtcNow;
            await this._db.SaveChangesAsync(cancellationToken);
            if (previousOptimizedAvatarId.HasValue)
            {
                await OptimizedAvatarAssetCleanup.DeleteOwnedIfOrphanedAsync(
                    this._db,
                    this._assets,
                    currentUserId,
                    previousOptimizedAvatarId.Value,
                    CancellationToken.None);
            }
            await this.NotifyChangedAsync(serverId, currentUserId, cancellationToken);
        }

        return ToOwnResponse(member);
    }

    private Task<bool> IsActiveMemberAsync(
        Guid userId,
        Guid serverId,
        CancellationToken cancellationToken)
    {
        return this._db.ServerMembers.AsNoTracking().AnyAsync(
            member =>
                member.ServerId == serverId &&
                member.UserId == userId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.LeftAt == null &&
                member.BannedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active &&
                member.Server.DeletedAt == null,
            cancellationToken);
    }

    private async Task<ServerMember?> LoadActiveMemberAsync(
        Guid serverId,
        Guid userId,
        bool tracking,
        CancellationToken cancellationToken)
    {
        IQueryable<ServerMember> query = this._db.ServerMembers
            .Include(member => member.User)
                .ThenInclude(user => user.Profile)
            .Include(member => member.User)
                .ThenInclude(user => user.ProfileSettings)
                .ThenInclude(settings => settings.SelectedTheme)
            .Include(member => member.ServerProfile)
            .Include(member => member.Roles
                .Where(assignment =>
                    assignment.RevokedAt == null &&
                    assignment.Role.DeletedAt == null))
                .ThenInclude(assignment => assignment.Role);
        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(
            member =>
                member.ServerId == serverId &&
                member.UserId == userId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.LeftAt == null &&
                member.BannedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active &&
                member.Server.DeletedAt == null,
            cancellationToken);
    }

    private async Task PopulateMutualContextAsync(
        ServerMemberViewerProfileResponse response,
        Guid currentUserId,
        Guid targetUserId,
        CancellationToken cancellationToken)
    {
        var mutualFriendIdsQuery = (
            from viewerFriend in this._db.UserFriends.AsNoTracking()
            join targetFriend in this._db.UserFriends.AsNoTracking()
                on viewerFriend.FriendUserId equals targetFriend.FriendUserId
            where viewerFriend.UserId == currentUserId &&
                  targetFriend.UserId == targetUserId &&
                  viewerFriend.FriendUserId != currentUserId &&
                  viewerFriend.FriendUserId != targetUserId &&
                  targetFriend.FriendUser.DeletedAt == null &&
                  targetFriend.FriendUser.StatusId == UserStatusIds.Active
            select targetFriend.FriendUserId)
            .Distinct();

        response.MutualFriendCount = await mutualFriendIdsQuery.CountAsync(
            cancellationToken);
        response.MutualFriends = await this._db.Users
            .AsNoTracking()
            .Where(user => mutualFriendIdsQuery.Contains(user.Id))
            .OrderBy(user => user.Profile.DisplayNameNorm)
            .ThenBy(user => user.Id)
            .Take(MutualPreviewLimit)
            .Select(user => new ServerMemberProfileMutualFriendResponse
            {
                UserId = user.Id,
                Login = user.Login,
                DisplayName = user.Profile.DisplayName,
                AvatarAssetId = user.Profile.AvatarAssetId,
                AvatarCropOffsetX = user.Profile.AvatarCropOffsetX,
                AvatarCropOffsetY = user.Profile.AvatarCropOffsetY,
                AvatarCropZoom = user.Profile.AvatarCropZoom
            })
            .ToListAsync(cancellationToken);

        var mutualServerIdsQuery = (
            from viewerMember in this._db.ServerMembers.AsNoTracking()
            join targetMember in this._db.ServerMembers.AsNoTracking()
                on viewerMember.ServerId equals targetMember.ServerId
            where viewerMember.UserId == currentUserId &&
                  viewerMember.StatusId == ServerMemberStatusIds.Active &&
                  viewerMember.LeftAt == null &&
                  viewerMember.BannedAt == null &&
                  targetMember.UserId == targetUserId &&
                  targetMember.StatusId == ServerMemberStatusIds.Active &&
                  targetMember.LeftAt == null &&
                  targetMember.BannedAt == null &&
                  targetMember.Server.DeletedAt == null
            select targetMember.ServerId)
            .Distinct();

        response.MutualServerCount = await mutualServerIdsQuery.CountAsync(
            cancellationToken);
        response.MutualServers = await this._db.Servers
            .AsNoTracking()
            .Where(server => mutualServerIdsQuery.Contains(server.Id))
            .OrderBy(server => server.Title)
            .ThenBy(server => server.Id)
            .Take(MutualPreviewLimit)
            .Select(server => new ServerMemberProfileMutualServerResponse
            {
                ServerId = server.Id,
                Title = server.Title,
                IconAssetId = server.IconAssetId,
                IconCropOffsetX = server.IconCropOffsetX,
                IconCropOffsetY = server.IconCropOffsetY,
                IconCropZoom = server.IconCropZoom
            })
            .ToListAsync(cancellationToken);
    }

    private Task<Asset?> GetOwnedAssetAsync(
        Guid userId,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        return this._db.Assets.AsNoTracking().FirstOrDefaultAsync(
            asset =>
                asset.Id == assetId &&
                asset.OwnerUserId == userId &&
                asset.DeletedAt == null,
            cancellationToken);
    }

    private async Task<Guid> UploadOptimizedAvatarAssetAsync(
        Guid userId,
        MemoryStream content,
        string? sourceFileName,
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
        var asset = await this._assets.UploadOptimizedAvatarAsync(
            userId,
            formFile,
            this._avatarImageProcessor.OutputSizePixels,
            cancellationToken);
        return asset.Id;
    }

    private async Task NotifyChangedAsync(
        Guid serverId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var payload = new { serverId, userId };
        await this._realtime.NotifyServerBestEffortAsync(
            this._logger,
            serverId,
            RealtimeEventNames.ServerMembersChanged,
            payload,
            cancellationToken);
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            userId,
            RealtimeEventNames.UserProfileChanged,
            payload,
            cancellationToken);
    }

    private static ServerMemberViewerProfileResponse ToViewerResponse(
        ServerMember member)
    {
        var settings = member.User.ProfileSettings;
        return PopulateResponse(
            new ServerMemberViewerProfileResponse
            {
                MemberId = member.Id,
                JoinedAt = member.JoinedAt,
                ProfileThemeCode = settings?.SelectedTheme?.Code ??
                    DefaultProfileThemeCode,
                ProfileColor = settings?.ProfileColor,
                ProfileBackgroundAssetId =
                    settings?.ProfileBackgroundAssetId,
                Roles = member.Roles
                    .Where(assignment =>
                        assignment.RevokedAt == null &&
                        assignment.Role.DeletedAt == null)
                    .OrderBy(assignment => assignment.Role.Title)
                    .ThenBy(assignment => assignment.Role.Id)
                    .Select(assignment =>
                        new ServerMemberProfileRoleResponse
                        {
                            Id = assignment.Role.Id,
                            Title = assignment.Role.Title,
                            Color = assignment.Role.Color
                        })
                    .ToList()
            },
            member,
            includeOwnerAvatarEditingData: false);
    }

    private static OwnServerMemberProfileResponse ToOwnResponse(
        ServerMember member)
    {
        var global = member.User.Profile;
        var server = member.ServerProfile;
        return PopulateResponse(
            new OwnServerMemberProfileResponse
            {
                AvatarSourceAssetId = server?.AvatarAssetId != null
                    ? server.AvatarSourceAssetId
                    : global.AvatarSourceAssetId
            },
            member,
            includeOwnerAvatarEditingData: true);
    }

    private static TResponse PopulateResponse<TResponse>(
        TResponse response,
        ServerMember member,
        bool includeOwnerAvatarEditingData)
        where TResponse : ServerMemberProfileResponse
    {
        var global = member.User.Profile;
        var server = member.ServerProfile;
        var usesServerAvatar = server?.AvatarAssetId != null;

        response.ServerId = member.ServerId;
        response.UserId = member.UserId;
        response.Login = member.User.Login;
        response.DisplayName = server?.DisplayName ?? global.DisplayName;
        response.AvatarAssetId = server?.AvatarAssetId ?? global.AvatarAssetId;
        response.AvatarCropOffsetX = usesServerAvatar
            ? includeOwnerAvatarEditingData
                ? server!.AvatarCropOffsetX
                : 0
            : global.AvatarCropOffsetX;
        response.AvatarCropOffsetY = usesServerAvatar
            ? includeOwnerAvatarEditingData
                ? server!.AvatarCropOffsetY
                : 0
            : global.AvatarCropOffsetY;
        response.AvatarCropZoom = usesServerAvatar
            ? includeOwnerAvatarEditingData
                ? server!.AvatarCropZoom
                : 1
            : global.AvatarCropZoom;
        response.BannerAssetId = server?.BannerAssetId ?? global.BannerAssetId;
        response.About = server?.About ?? global.Bio;
        response.StatusText = server?.StatusText;
        response.UpdatedAt = server?.UpdatedAt ?? global.UpdatedAt;
        response.Inheritance = new ServerMemberProfileInheritanceResponse
        {
            DisplayName = server?.DisplayName == null,
            Avatar = server?.AvatarAssetId == null,
            Banner = server?.BannerAssetId == null,
            About = server?.About == null
        };

        return response;
    }

    private static void ResetAvatar(ServerMemberProfile profile)
    {
        profile.AvatarAssetId = null;
        profile.AvatarSourceAssetId = null;
        profile.AvatarCropOffsetX = 0;
        profile.AvatarCropOffsetY = 0;
        profile.AvatarCropZoom = 1;
    }

    private static void ValidatePatchAvatarFields(
        UpdateServerMemberProfileRequest request)
    {
        var containsDirectAvatarAssignment =
            request.AvatarAssetId.HasValue ||
            request.AvatarSourceAssetId.HasValue ||
            request.AvatarCropOffsetX.HasValue ||
            request.AvatarCropOffsetY.HasValue ||
            request.AvatarCropZoom.HasValue;
        if (containsDirectAvatarAssignment)
        {
            // Server avatars must always be generated by SetOwnAvatarAsync.
            // In particular, a reusable source Avatar must never become the
            // final public image through the generic profile PATCH.
            throw new InvalidUserProfileDataException(
                ExceptionMessages.ProfileAvatarAssetTypeIsInvalid);
        }
    }

    private static void ValidateAvatarCrop(
        SetServerMemberProfileAvatarRequest request)
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

    private static string? NormalizeOptional(string value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static bool RequiresStoredProfile(
        UpdateServerMemberProfileRequest request)
    {
        return request.DisplayName != null ||
               request.AvatarAssetId.HasValue ||
               request.BannerAssetId.HasValue ||
               !string.IsNullOrWhiteSpace(request.About) ||
               !string.IsNullOrWhiteSpace(request.StatusText);
    }

    private static bool HasOverrides(ServerMemberProfile profile)
    {
        return profile.DisplayName != null ||
               profile.AvatarAssetId.HasValue ||
               profile.BannerAssetId.HasValue ||
               profile.About != null ||
               profile.StatusText != null;
    }

    private async Task DeleteCompensatingAssetAsync(
        Guid userId,
        Guid assetId)
    {
        try
        {
            await this._assets.DeleteOwnedAssetAsync(
                userId,
                assetId,
                CancellationToken.None);
        }
        catch (Exception exception)
        {
            this._logger.LogError(
                exception,
                "Failed to compensate server profile avatar {AssetId} for user {UserId}.",
                assetId,
                userId);
        }
    }
}
