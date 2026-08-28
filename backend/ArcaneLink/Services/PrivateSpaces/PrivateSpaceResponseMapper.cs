using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Users;

namespace ArcaneLink.Services.PrivateSpaces;

internal static class PrivateSpaceResponseMapper
{
    internal static PrivateSpaceResponse ToPrivateSpaceResponse(
        PrivateSpace privateSpace,
        Guid currentUserId,
        IReadOnlyDictionary<Guid, UserPresenceSnapshot> presence,
        SpaceMessageResponse? lastMessage = null,
        long unreadCount = 0,
        IReadOnlySet<Guid>? blockedUserIds = null)
    {
        var viewerMembership = privateSpace.Members.FirstOrDefault(member =>
            member.UserId == currentUserId &&
            member.StatusId == PrivateSpaceIds.MemberStatusActive);

        return new PrivateSpaceResponse
        {
            SpaceId = privateSpace.SpaceId,
            CreatedByUserId = privateSpace.CreatedByUserId,
            OwnerUserId = privateSpace.OwnerUserId,
            Kind = privateSpace.Kind,
            Title = privateSpace.Title,
            Description = privateSpace.Description,
            AvatarAssetId = privateSpace.AvatarAssetId,
            AvatarCropOffsetX = privateSpace.AvatarCropOffsetX,
            AvatarCropOffsetY = privateSpace.AvatarCropOffsetY,
            AvatarCropZoom = privateSpace.AvatarCropZoom,
            CreatedAt = privateSpace.CreatedAt,
            UpdatedAt = privateSpace.UpdatedAt,
            DeletedAt = privateSpace.DeletedAt,
            UnreadCount = unreadCount,
            ViewerSettings = new PrivateSpaceViewerSettingsResponse
            {
                Note = viewerMembership?.Note,
                CustomNickname = viewerMembership?.PeerNickname,
                CustomAvatarAssetId = viewerMembership?.PeerAvatarAssetId,
                CustomAvatarCropOffsetX =
                    viewerMembership?.PeerAvatarCropOffsetX ?? 0,
                CustomAvatarCropOffsetY =
                    viewerMembership?.PeerAvatarCropOffsetY ?? 0,
                CustomAvatarCropZoom =
                    viewerMembership?.PeerAvatarCropZoom ?? 1,
                MutedUntil = viewerMembership?.MutedUntil,
                IsMutedIndefinitely =
                    viewerMembership?.IsMutedIndefinitely ?? false,
                IsPeerBlocked =
                    privateSpace.Kind == PrivateSpaceKindCodes.Direct &&
                    privateSpace.Members.Any(member =>
                        member.UserId != currentUserId &&
                        blockedUserIds?.Contains(member.UserId) == true)
            },
            Members = privateSpace.Members
                .OrderBy(x => x.User.Profile.DisplayNameNorm)
                .Select(member => ToMemberResponse(
                    member,
                    presence.GetValueOrDefault(
                        member.UserId,
                        UserPresenceSnapshot.Hidden)))
                .ToList(),
            LastMessage = lastMessage
        };
    }

    internal static PrivateSpaceMemberResponse ToMemberResponse(
        PrivateSpaceMember member,
        UserPresenceSnapshot presence)
    {
        return new PrivateSpaceMemberResponse
        {
            Id = member.Id,
            SpaceId = member.SpaceId,
            UserId = member.UserId,
            StatusCode = member.Status.Code,
            JoinedAt = member.JoinedAt,
            LeftAt = member.LeftAt,
            AddedByUserId = member.AddedByUserId,
            CreatedAt = member.CreatedAt,
            UpdatedAt = member.UpdatedAt,
            User = new FriendUserResponse
            {
                Id = member.User.Id,
                Login = member.User.Login,
                DisplayName = member.User.Profile.DisplayName,
                AvatarAssetId = member.User.Profile.AvatarAssetId,
                AvatarCropOffsetX = member.User.Profile.AvatarCropOffsetX,
                AvatarCropOffsetY = member.User.Profile.AvatarCropOffsetY,
                AvatarCropZoom = member.User.Profile.AvatarCropZoom,
                PresenceStatus = presence.PresenceStatus,
                LastSeenAt = presence.LastSeenAt
            }
        };
    }
}
