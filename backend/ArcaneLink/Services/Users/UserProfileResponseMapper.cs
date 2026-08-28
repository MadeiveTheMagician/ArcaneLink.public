using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.Services.Users;

internal static class UserProfileResponseMapper
{
    private const string UnavailableProfileLabel = "Unavailable";

    internal static PublicUserProfileResponse CreateUnavailableProfile(Guid userId)
    {
        return new PublicUserProfileResponse
        {
            Id = userId,
            Login = UnavailableProfileLabel,
            DisplayName = UnavailableProfileLabel
        };
    }

    internal static PublicUserProfileResponse ToPublicProfileResponse(
        User user,
        UserPresenceSnapshot presence)
    {
        return PopulateProfileResponse(
            new PublicUserProfileResponse(),
            user,
            presence);
    }

    internal static OwnUserProfileResponse ToOwnProfileResponse(
        User user,
        UserPresenceSnapshot presence)
    {
        return PopulateProfileResponse(
            new OwnUserProfileResponse
            {
                AvatarSourceAssetId = user.Profile.AvatarSourceAssetId
            },
            user,
            presence);
    }

    private static TResponse PopulateProfileResponse<TResponse>(
        TResponse response,
        User user,
        UserPresenceSnapshot presence)
        where TResponse : PublicUserProfileResponse
    {
        response.Id = user.Id;
        response.Login = user.Login;
        response.DisplayName = user.Profile.DisplayName;
        response.AvatarAssetId = user.Profile.AvatarAssetId;
        response.AvatarCropOffsetX = user.Profile.AvatarCropOffsetX;
        response.AvatarCropOffsetY = user.Profile.AvatarCropOffsetY;
        response.AvatarCropZoom = user.Profile.AvatarCropZoom;
        response.BannerAssetId = user.Profile.BannerAssetId;
        response.Bio = user.Profile.Bio;
        response.WebsiteUrl = user.Profile.WebsiteUrl;
        response.CreatedAt = user.CreatedAt;
        response.PresenceStatus = presence.PresenceStatus;
        response.LastSeenAt = presence.LastSeenAt;
        response.SubscriptionType = ToSubscriptionTypeResponse(user.SubscriptionType);
        response.Tags = user.Profile.Tags
            .OrderBy(x => x.Tag.DisplayOrder)
            .Select(x => ToProfileTagResponse(x.Tag))
            .ToList();

        return response;
    }

    internal static SubscriptionTypeResponse ToSubscriptionTypeResponse(
        SubscriptionType subscriptionType)
    {
        return new SubscriptionTypeResponse
        {
            Id = subscriptionType.Id,
            Code = subscriptionType.Code,
            Title = subscriptionType.Title,
            Rank = subscriptionType.Rank
        };
    }

    internal static FriendUserResponse ToFriendUserResponse(
        User user,
        UserPresenceSnapshot presence,
        int mutualServerCount = 0,
        int mutualFriendCount = 0,
        int sharedTagCount = 0,
        int recommendationScore = 0,
        bool isFriend = false,
        bool hasIncomingFriendRequest = false,
        bool hasOutgoingFriendRequest = false)
    {
        return new FriendUserResponse
        {
            Id = user.Id,
            Login = user.Login,
            DisplayName = user.Profile.DisplayName,
            AvatarAssetId = user.Profile.AvatarAssetId,
            AvatarCropOffsetX = user.Profile.AvatarCropOffsetX,
            AvatarCropOffsetY = user.Profile.AvatarCropOffsetY,
            AvatarCropZoom = user.Profile.AvatarCropZoom,
            PresenceStatus = presence.PresenceStatus,
            LastSeenAt = presence.LastSeenAt,
            Tags = user.Profile.Tags
                .OrderBy(x => x.Tag.DisplayOrder)
                .Select(x => ToProfileTagResponse(x.Tag))
                .ToList(),
            MutualServerCount = mutualServerCount,
            MutualFriendCount = mutualFriendCount,
            SharedTagCount = sharedTagCount,
            RecommendationScore = recommendationScore,
            IsFriend = isFriend,
            HasIncomingFriendRequest = hasIncomingFriendRequest,
            HasOutgoingFriendRequest = hasOutgoingFriendRequest
        };
    }

    internal static ProfileTagResponse ToProfileTagResponse(ProfileTag tag)
    {
        return new ProfileTagResponse
        {
            Id = tag.Id,
            Code = tag.Code,
            Title = tag.Title
        };
    }
}
