using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Realtime;

public sealed class UserPresenceAudienceServiceTests
{
    [Fact]
    public async Task ResolveAsync_ComposesAudienceAndFiltersInactiveRelationships()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.CreateClient();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider
            .GetRequiredService<IUserPresenceAudienceService>();

        var initial = await service.ResolveAsync(ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(
            [ArcaneLinkApiFactory.OwnerUserId],
            initial.SelfRecipients);
        Assert.Equal(
            [ArcaneLinkApiFactory.OwnerUserId],
            initial.FriendRecipients);
        Assert.Equal(
            [ArcaneLinkApiFactory.OwnerUserId],
            initial.FriendsOfFriendsRecipients);
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            initial.SharedServerRecipients.Order());
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            initial.EveryoneRecipients.Order());

        await AddFriendshipAsync(
            db,
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var withFriend = await service.ResolveAsync(
            ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withFriend.FriendRecipients.Order());
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withFriend.EveryoneRecipients.Order());

        await AddFriendshipAsync(
            db,
            ArcaneLinkApiFactory.OutsiderUserId,
            ArcaneLinkApiFactory.MemberUserId);
        var withCommonFriend = await service.ResolveAsync(
            ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withCommonFriend.FriendsOfFriendsRecipients.Order());
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withCommonFriend
                .GetRecipients("custom:friends_of_friends")
                .Order());
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withCommonFriend
                .GetRecipients("custom:shared_servers")
                .Order());
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withCommonFriend
                .GetRecipients("custom:friends")
                .Order());

        db.UserFriends.RemoveRange(
            db.UserFriends.Where(friend =>
                (friend.UserId == ArcaneLinkApiFactory.OwnerUserId &&
                 friend.FriendUserId == ArcaneLinkApiFactory.OutsiderUserId) ||
                (friend.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                 friend.FriendUserId == ArcaneLinkApiFactory.OwnerUserId)));
        var outsiderPrivateMember = await AddPrivateSpaceAsync(db);
        await db.SaveChangesAsync();

        var withPrivateSpace = await service.ResolveAsync(
            ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(
            [ArcaneLinkApiFactory.OwnerUserId],
            withPrivateSpace.FriendRecipients);
        Assert.Equal(
            new[]
            {
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.OutsiderUserId,
                ArcaneLinkApiFactory.OwnerUserId
            }.Order(),
            withPrivateSpace.EveryoneRecipients.Order());

        var serverMember = await db.ServerMembers.SingleAsync(
            member => member.Id == ArcaneLinkApiFactory.MemberMemberId);
        serverMember.BannedAt = DateTime.UtcNow;
        outsiderPrivateMember.StatusId = PrivateSpaceIds.MemberStatusLeft;
        await db.SaveChangesAsync();

        var filtered = await service.ResolveAsync(ArcaneLinkApiFactory.OwnerUserId);

        Assert.Equal(
            [ArcaneLinkApiFactory.OwnerUserId],
            filtered.EveryoneRecipients);

        var owner = await db.Users.SingleAsync(
            user => user.Id == ArcaneLinkApiFactory.OwnerUserId);
        owner.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var inactiveSubject = await service.ResolveAsync(
            ArcaneLinkApiFactory.OwnerUserId);
        Assert.Empty(inactiveSubject.SelfRecipients);
        Assert.Empty(inactiveSubject.FriendRecipients);
        Assert.Empty(inactiveSubject.FriendsOfFriendsRecipients);
        Assert.Empty(inactiveSubject.SharedServerRecipients);
        Assert.Empty(inactiveSubject.EveryoneRecipients);
    }

    private static async Task AddFriendshipAsync(
        AppDbContext db,
        Guid firstUserId,
        Guid secondUserId)
    {
        var requestId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.FriendRequests.Add(new FriendRequest
        {
            Id = requestId,
            FromUserId = firstUserId,
            ToUserId = secondUserId,
            StatusId = FriendRequestStatusIds.Accepted,
            CreatedAt = now,
            UpdatedAt = now,
            RespondedAt = now
        });
        db.UserFriends.AddRange(
            new UserFriend
            {
                UserId = firstUserId,
                FriendUserId = secondUserId,
                CreatedByRequestId = requestId,
                CreatedAt = now
            },
            new UserFriend
            {
                UserId = secondUserId,
                FriendUserId = firstUserId,
                CreatedByRequestId = requestId,
                CreatedAt = now
            });
        await db.SaveChangesAsync();
    }

    private static async Task<PrivateSpaceMember> AddPrivateSpaceAsync(
        AppDbContext db)
    {
        var now = DateTime.UtcNow;
        var spaceId = Guid.NewGuid();
        var outsiderMember = new PrivateSpaceMember
        {
            Id = Guid.NewGuid(),
            SpaceId = spaceId,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = PrivateSpaceIds.MemberStatusActive,
            JoinedAt = now,
            AddedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var privateSpace = new PrivateSpace
        {
            SpaceId = spaceId,
            Space = new Space
            {
                Id = spaceId,
                TypeId = SpaceIds.TypeTextRoom,
                CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                Title = "Presence audience",
                Position = 0,
                CreatedAt = now,
                UpdatedAt = now
            },
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
            Kind = PrivateSpaceKindCodes.Group,
            CreatedAt = now,
            UpdatedAt = now,
            Members =
            [
                new PrivateSpaceMember
                {
                    Id = Guid.NewGuid(),
                    SpaceId = spaceId,
                    UserId = ArcaneLinkApiFactory.OwnerUserId,
                    StatusId = PrivateSpaceIds.MemberStatusActive,
                    JoinedAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                },
                outsiderMember
            ]
        };
        db.PrivateSpaces.Add(privateSpace);
        await db.SaveChangesAsync();
        return outsiderMember;
    }
}
