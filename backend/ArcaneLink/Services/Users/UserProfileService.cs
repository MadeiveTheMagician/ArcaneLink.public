using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Users.UserProfileResponseMapper;

namespace ArcaneLink.Services.Users;

public class UserProfileService : IUserProfileService
{

    private readonly AppDbContext _db;
    private readonly IRealtimeNotificationService _realtime;
    private readonly IUserProfileTagService _profileTagService;
    private readonly IUserPresencePolicyService _presencePolicy;

    public UserProfileService(
        AppDbContext db,
        IRealtimeNotificationService realtime,
        IUserProfileTagService profileTagService,
        IUserPresencePolicyService presencePolicy)
    {
        this._db = db;
        this._realtime = realtime;
        this._profileTagService = profileTagService;
        this._presencePolicy = presencePolicy;
    }

    public async Task<UserResponse?> GetCurrentUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users
            .Include(x => x.Profile)
            .Include(x => x.SubscriptionType)
            .FirstOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);

        if (user == null)
        {
            return null;
        }

        var presence = await this.ResolvePresenceAsync(
            userId,
            user.Id,
            cancellationToken);

        return new UserResponse
        {
            Id = user.Id,
            Login = user.Login,
            DisplayName = user.Profile.DisplayName,
            Email = user.Email,
            SubscriptionType = ToSubscriptionTypeResponse(user.SubscriptionType),
            CreatedAt = user.CreatedAt,
            PresenceStatus = presence.PresenceStatus,
            LastSeenAt = presence.LastSeenAt,
            EmailConfirmedAt = user.EmailConfirmedAt
        };
    }

    public async Task<PublicUserProfileResponse?> GetPublicProfileAsync(
        Guid userId,
        Guid? viewerUserId = null,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users
            .Include(x => x.Profile)
                .ThenInclude(x => x.Tags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.SubscriptionType)
            .FirstOrDefaultAsync(
                x => x.Id == userId,
                cancellationToken);

        if (user == null)
        {
            return null;
        }

        if (user.DeletedAt != null || user.StatusId != UserStatusIds.Active)
        {
            return CreateUnavailableProfile(user.Id);
        }

        var presence = await this.ResolvePresenceAsync(
            viewerUserId,
            user.Id,
            cancellationToken);

        return ToPublicProfileResponse(user, presence);
    }

    public async Task<OwnUserProfileResponse?> GetOwnProfileAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users
            .Include(x => x.Profile)
                .ThenInclude(x => x.Tags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.SubscriptionType)
            .FirstOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);

        if (user == null)
        {
            return null;
        }

        var presence = await this.ResolvePresenceAsync(
            userId,
            user.Id,
            cancellationToken);

        return ToOwnProfileResponse(user, presence);
    }

    public async Task<OwnUserProfileResponse?> UpdateProfileAsync(
        Guid userId,
        UpdateUserProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users
            .Include(x => x.Profile)
                .ThenInclude(x => x.Tags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.SubscriptionType)
            .FirstOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);

        if (user == null)
        {
            return null;
        }

        ApplyProfileChanges(user, request);
        if (request.TagIds != null)
        {
            await this._profileTagService.ReplaceUserProfileTagsAsync(
                userId,
                request.TagIds,
                cancellationToken);
        }

        user.UpdatedAt = DateTime.UtcNow;
        user.Profile.UpdatedAt = DateTime.UtcNow;

        await this._db.SaveChangesAsync(cancellationToken);
        await this._realtime.NotifyUserAsync(
            userId,
            RealtimeEventNames.UserProfileChanged,
            new { userId },
            cancellationToken);

        var presence = await this.ResolvePresenceAsync(
            userId,
            user.Id,
            cancellationToken);

        return ToOwnProfileResponse(user, presence);
    }

    private async Task<UserPresenceSnapshot> ResolvePresenceAsync(
        Guid? viewerUserId,
        Guid targetUserId,
        CancellationToken cancellationToken)
    {
        var snapshots = await this._presencePolicy.ResolveAsync(
            viewerUserId,
            [targetUserId],
            cancellationToken);

        return snapshots.GetValueOrDefault(
            targetUserId,
            UserPresenceSnapshot.Hidden);
    }

    private static void ApplyProfileChanges(
        User user,
        UpdateUserProfileRequest request)
    {
        if (request.DisplayName == null &&
            request.Bio == null &&
            request.WebsiteUrl == null &&
            request.TagIds == null)
        {
            throw new InvalidUserProfileDataException(
                ExceptionMessages.ProfileUpdateIsEmpty);
        }

        if (request.DisplayName != null)
        {
            var displayName = request.DisplayName.Trim();

            if (string.IsNullOrWhiteSpace(displayName))
            {
                throw new InvalidUserProfileDataException(
                    ExceptionMessages.DisplayNameIsRequired);
            }

            user.Profile.DisplayName = displayName;
            user.Profile.DisplayNameNorm = displayName.ToUpperInvariant();
        }

        if (request.Bio != null)
        {
            user.Profile.Bio = string.IsNullOrWhiteSpace(request.Bio)
                ? null
                : request.Bio.Trim();
        }

        if (request.WebsiteUrl != null)
        {
            var websiteUrl = request.WebsiteUrl.Trim();

            if (string.IsNullOrWhiteSpace(websiteUrl))
            {
                user.Profile.WebsiteUrl = null;
            }
            else
            {
                ValidateWebsiteUrl(websiteUrl);
                user.Profile.WebsiteUrl = websiteUrl;
            }
        }
    }

    private static void ValidateWebsiteUrl(string websiteUrl)
    {
        if (!Uri.TryCreate(websiteUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp &&
             uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidUserProfileDataException(
                ExceptionMessages.WebsiteUrlIsInvalid);
        }
    }



}
