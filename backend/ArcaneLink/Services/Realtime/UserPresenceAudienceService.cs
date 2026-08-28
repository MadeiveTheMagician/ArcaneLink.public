using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Realtime;

public sealed class UserPresenceAudienceService : IUserPresenceAudienceService
{
    private readonly AppDbContext _db;

    public UserPresenceAudienceService(AppDbContext db)
    {
        this._db = db;
    }

    public async Task<UserPresenceAudienceSnapshot> ResolveAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var isActiveUser = await this._db.Users
            .AsNoTracking()
            .AnyAsync(
                user =>
                    user.Id == userId &&
                    user.DeletedAt == null &&
                    user.StatusId == UserStatusIds.Active,
                cancellationToken);
        if (!isActiveUser)
        {
            return UserPresenceAudienceSnapshot.Empty;
        }

        var friendIds = await this._db.UserFriends
            .AsNoTracking()
            .Where(friend =>
                friend.UserId == userId &&
                friend.CreatedByRequest.StatusId == FriendRequestStatusIds.Accepted &&
                friend.FriendUser.DeletedAt == null &&
                friend.FriendUser.StatusId == UserStatusIds.Active)
            .Select(friend => friend.FriendUserId)
            .ToHashSetAsync(cancellationToken);

        var friendsOfFriendsIds = await (
                from subjectFriend in this._db.UserFriends.AsNoTracking()
                join recipientFriend in this._db.UserFriends.AsNoTracking()
                    on subjectFriend.FriendUserId equals
                    recipientFriend.FriendUserId
                where
                    subjectFriend.UserId == userId &&
                    recipientFriend.UserId != userId &&
                    subjectFriend.CreatedByRequest.StatusId ==
                    FriendRequestStatusIds.Accepted &&
                    recipientFriend.CreatedByRequest.StatusId ==
                    FriendRequestStatusIds.Accepted &&
                    subjectFriend.FriendUser.StatusId ==
                    UserStatusIds.Active &&
                    subjectFriend.FriendUser.DeletedAt == null &&
                    recipientFriend.User.StatusId ==
                    UserStatusIds.Active &&
                    recipientFriend.User.DeletedAt == null
                select recipientFriend.UserId)
            .Distinct()
            .ToHashSetAsync(cancellationToken);

        var activeServerIds = this._db.ServerMembers
            .AsNoTracking()
            .Where(member =>
                member.UserId == userId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.BannedAt == null &&
                member.Server.DeletedAt == null)
            .Select(member => member.ServerId);
        var sharedServerUserIds = this._db.ServerMembers
            .AsNoTracking()
            .Where(member =>
                activeServerIds.Contains(member.ServerId) &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.BannedAt == null &&
                member.Server.DeletedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active)
            .Select(member => member.UserId);

        var activePrivateSpaceIds = this._db.PrivateSpaceMembers
            .AsNoTracking()
            .Where(member =>
                member.UserId == userId &&
                member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                member.PrivateSpace.DeletedAt == null &&
                member.PrivateSpace.Space.DeletedAt == null)
            .Select(member => member.SpaceId);
        var sharedPrivateSpaceUserIds = this._db.PrivateSpaceMembers
            .AsNoTracking()
            .Where(member =>
                activePrivateSpaceIds.Contains(member.SpaceId) &&
                member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                member.PrivateSpace.DeletedAt == null &&
                member.PrivateSpace.Space.DeletedAt == null &&
                member.User.DeletedAt == null &&
                member.User.StatusId == UserStatusIds.Active)
            .Select(member => member.UserId);

        var sharedServerIds = await sharedServerUserIds
            .Distinct()
            .ToHashSetAsync(cancellationToken);
        var sharedUserIds = await sharedServerUserIds
            .Union(sharedPrivateSpaceUserIds)
            .ToListAsync(cancellationToken);

        var selfRecipients = new HashSet<Guid> { userId };
        var friendRecipients = new HashSet<Guid>(friendIds) { userId };
        var friendsOfFriendsRecipients =
            new HashSet<Guid>(friendsOfFriendsIds) { userId };
        var sharedServerRecipients =
            new HashSet<Guid>(sharedServerIds) { userId };
        var everyoneRecipients = new HashSet<Guid>(friendRecipients);
        everyoneRecipients.UnionWith(friendsOfFriendsRecipients);
        everyoneRecipients.UnionWith(sharedUserIds);

        return new UserPresenceAudienceSnapshot(
            selfRecipients,
            friendRecipients,
            friendsOfFriendsRecipients,
            sharedServerRecipients,
            everyoneRecipients);
    }
}
