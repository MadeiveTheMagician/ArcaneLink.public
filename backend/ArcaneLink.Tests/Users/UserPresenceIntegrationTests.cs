using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Users;

public sealed class UserPresenceIntegrationTests
{
    [Fact]
    public async Task ProfileSettings_DefaultUpdateAndStrictValidation_AreStable()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var defaults = await client.GetFromJsonAsync<UserProfileSettingsResponse>(
            "/api/users/me/profile/settings");

        Assert.NotNull(defaults);
        Assert.Equal(PresenceVisibilityCodes.Everyone, defaults.PresenceVisibility);
        Assert.True(defaults.ShowLastSeen);
        Assert.Equal(PresenceModeCodes.Automatic, defaults.PresenceMode);
        Assert.True(defaults.ShowPrivateReadAllButton);
        Assert.False(defaults.IsAllPrivateSpaceOrderLocked);
        Assert.Equal(
            MessageDisplayFormatCodes.WallScroll,
            defaults.ServerMessageDisplayFormat);
        Assert.Equal(
            MessageDisplayFormatCodes.WallScroll,
            defaults.PrivateMessageDisplayFormat);
        Assert.Equal(
            MessageBubbleAlignmentCodes.OwnRight,
            defaults.ServerMessageBubbleAlignment);
        Assert.Equal(
            MessageBubbleAlignmentCodes.OwnRight,
            defaults.PrivateMessageBubbleAlignment);
        Assert.Equal(
            MessageBubbleWidthCodes.Standard,
            defaults.ServerMessageBubbleWidth);
        Assert.Equal(
            MessageBubbleWidthCodes.Standard,
            defaults.PrivateMessageBubbleWidth);

        var updateResponse = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PresenceVisibility = " FRIENDS ",
                ShowLastSeen = false,
                PresenceMode = " INVISIBLE ",
                ShowPrivateReadAllButton = false,
                ServerMessageDisplayFormat = " BUBBLE ",
                PrivateMessageDisplayFormat = " BUBBLE ",
                ServerMessageBubbleAlignment = " ONE-SIDE-LEFT ",
                PrivateMessageBubbleAlignment = " OWN-LEFT ",
                ServerMessageBubbleWidth = " FULL-WIDTH ",
                PrivateMessageBubbleWidth = " STANDARD "
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        var updated = await updateResponse.Content
            .ReadFromJsonAsync<UserProfileSettingsResponse>();

        Assert.NotNull(updated);
        Assert.Equal(PresenceVisibilityCodes.Friends, updated.PresenceVisibility);
        Assert.False(updated.ShowLastSeen);
        Assert.Equal(PresenceModeCodes.Invisible, updated.PresenceMode);
        Assert.False(updated.ShowPrivateReadAllButton);
        Assert.Equal(
            MessageDisplayFormatCodes.Bubble,
            updated.ServerMessageDisplayFormat);
        Assert.Equal(
            MessageDisplayFormatCodes.Bubble,
            updated.PrivateMessageDisplayFormat);
        Assert.Equal(
            MessageBubbleAlignmentCodes.OneSideLeft,
            updated.ServerMessageBubbleAlignment);
        Assert.Equal(
            MessageBubbleAlignmentCodes.OwnLeft,
            updated.PrivateMessageBubbleAlignment);
        Assert.Equal(
            MessageBubbleWidthCodes.FullWidth,
            updated.ServerMessageBubbleWidth);
        Assert.Equal(
            MessageBubbleWidthCodes.Standard,
            updated.PrivateMessageBubbleWidth);

        using var customPrivacyResponse = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                DirectMessagePermission =
                    " CUSTOM:shared_servers, friends_of_friends, friends "
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            customPrivacyResponse);
        var customPrivacy = (await customPrivacyResponse.Content
            .ReadFromJsonAsync<UserProfileSettingsResponse>())!;
        Assert.Equal(
            "custom:friends,friends_of_friends,shared_servers",
            customPrivacy.DirectMessagePermission);

        using var customPresenceResponse = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PresenceVisibility =
                    " CUSTOM:shared_servers, friends_of_friends, friends "
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            customPresenceResponse);
        var customPresence = (await customPresenceResponse.Content
            .ReadFromJsonAsync<UserProfileSettingsResponse>())!;
        Assert.Equal(
            "custom:friends,friends_of_friends,shared_servers",
            customPresence.PresenceVisibility);

        var invalidVisibility = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PresenceVisibility = "contacts"
            });
        var invalidMode = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PresenceMode = "busy"
            });
        var invalidMessageFormat = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PrivateMessageDisplayFormat = "compact"
            });
        var invalidDirectMessagePrivacy = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                DirectMessagePermission =
                    "custom:friends,followers"
            });
        var invalidMessageBubbleAlignment = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                ServerMessageBubbleAlignment = "alternating"
            });
        var invalidMessageBubbleWidth = await client.PatchAsJsonAsync(
            "/api/users/me/profile/settings",
            new UpdateUserProfileSettingsRequest
            {
                PrivateMessageBubbleWidth = "viewport"
            });

        Assert.Equal(HttpStatusCode.BadRequest, invalidVisibility.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalidMode.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalidMessageFormat.StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            invalidDirectMessagePrivacy.StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            invalidMessageBubbleAlignment.StatusCode);
        Assert.Equal(
            HttpStatusCode.BadRequest,
            invalidMessageBubbleWidth.StatusCode);

        var afterInvalid = await client.GetFromJsonAsync<UserProfileSettingsResponse>(
            "/api/users/me/profile/settings");
        Assert.NotNull(afterInvalid);
        Assert.Equal(
            "custom:friends,friends_of_friends,shared_servers",
            afterInvalid.PresenceVisibility);
        Assert.Equal(PresenceModeCodes.Invisible, afterInvalid.PresenceMode);
        Assert.Equal(
            MessageDisplayFormatCodes.Bubble,
            afterInvalid.PrivateMessageDisplayFormat);
        Assert.Equal(
            MessageBubbleAlignmentCodes.OneSideLeft,
            afterInvalid.ServerMessageBubbleAlignment);
        Assert.Equal(
            MessageBubbleWidthCodes.Standard,
            afterInvalid.PrivateMessageBubbleWidth);
        Assert.Equal(
            "custom:friends,friends_of_friends,shared_servers",
            afterInvalid.DirectMessagePermission);
    }

    [Fact]
    public async Task Policy_CustomVisibility_CombinesSelectedRelationshipCategories()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var policy = scope.ServiceProvider
            .GetRequiredService<IUserPresencePolicyService>();
        var registry = scope.ServiceProvider
            .GetRequiredService<RealtimeConnectionRegistry>();
        var viewerId = ArcaneLinkApiFactory.OwnerUserId;
        var targetId = ArcaneLinkApiFactory.MemberUserId;
        var commonFriendId = ArcaneLinkApiFactory.OutsiderUserId;
        var settings = await db.UserProfileSettings.SingleAsync(
            row => row.UserId == targetId);
        settings.PresenceMode = PresenceModeCodes.Automatic;
        settings.PresenceVisibility = "custom:shared_servers";
        await db.SaveChangesAsync();
        registry.Register(
            targetId,
            $"presence-custom-policy-{Guid.NewGuid():N}");

        var sharedServer = await ResolveOneAsync(
            policy,
            viewerId,
            targetId);
        Assert.Equal(
            PresenceStatusCodes.Online,
            sharedServer.PresenceStatus);

        settings.PresenceVisibility = "custom:friends_of_friends";
        await db.SaveChangesAsync();
        var withoutCommonFriend = await ResolveOneAsync(
            policy,
            viewerId,
            targetId);
        Assert.Equal(UserPresenceSnapshot.Hidden, withoutCommonFriend);

        await AddFriendshipAsync(db, viewerId, commonFriendId);
        await AddFriendshipAsync(db, targetId, commonFriendId);
        var friendOfFriend = await ResolveOneAsync(
            policy,
            viewerId,
            targetId);
        Assert.Equal(
            PresenceStatusCodes.Online,
            friendOfFriend.PresenceStatus);

        settings.PresenceVisibility = "custom:friends";
        await db.SaveChangesAsync();
        var directFriendOnly = await ResolveOneAsync(
            policy,
            viewerId,
            targetId);
        Assert.Equal(UserPresenceSnapshot.Hidden, directFriendOnly);

        settings.PresenceVisibility =
            "custom:friends,shared_servers";
        await db.SaveChangesAsync();
        var combined = await ResolveOneAsync(
            policy,
            viewerId,
            targetId);
        Assert.Equal(PresenceStatusCodes.Online, combined.PresenceStatus);
    }

    [Fact]
    public async Task Policy_EnforcesViewerVisibilityLastSeenAndInvisibleMode()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var policy = scope.ServiceProvider.GetRequiredService<IUserPresencePolicyService>();
        var registry = scope.ServiceProvider.GetRequiredService<RealtimeConnectionRegistry>();
        var targetId = ArcaneLinkApiFactory.OutsiderUserId;
        var viewerId = ArcaneLinkApiFactory.OwnerUserId;
        var lastSeenAt = new DateTime(2026, 7, 21, 9, 30, 0, DateTimeKind.Utc);
        var target = await db.Users.SingleAsync(user => user.Id == targetId);
        var settings = await db.UserProfileSettings.SingleAsync(x => x.UserId == targetId);
        target.LastSeenAt = lastSeenAt;
        settings.PresenceVisibility = PresenceVisibilityCodes.Everyone;
        settings.ShowLastSeen = true;
        settings.PresenceMode = PresenceModeCodes.Automatic;
        await db.SaveChangesAsync();
        registry.Register(targetId, $"presence-policy-{Guid.NewGuid():N}");

        var anonymous = await ResolveOneAsync(policy, null, targetId);
        var stranger = await ResolveOneAsync(policy, viewerId, targetId);
        Assert.Equal(PresenceStatusCodes.Online, anonymous.PresenceStatus);
        Assert.Equal(lastSeenAt, anonymous.LastSeenAt);
        Assert.Equal(PresenceStatusCodes.Online, stranger.PresenceStatus);

        settings.PresenceVisibility = PresenceVisibilityCodes.Friends;
        await db.SaveChangesAsync();
        stranger = await ResolveOneAsync(policy, viewerId, targetId);
        Assert.Equal(UserPresenceSnapshot.Hidden, stranger);

        await AddFriendshipAsync(db, viewerId, targetId);
        var friend = await ResolveOneAsync(policy, viewerId, targetId);
        Assert.Equal(PresenceStatusCodes.Online, friend.PresenceStatus);
        Assert.Equal(lastSeenAt, friend.LastSeenAt);

        settings.ShowLastSeen = false;
        await db.SaveChangesAsync();
        friend = await ResolveOneAsync(policy, viewerId, targetId);
        Assert.Equal(PresenceStatusCodes.Online, friend.PresenceStatus);
        Assert.Null(friend.LastSeenAt);

        settings.ShowLastSeen = true;
        settings.PresenceMode = PresenceModeCodes.Invisible;
        await db.SaveChangesAsync();
        friend = await ResolveOneAsync(policy, viewerId, targetId);
        Assert.Equal(PresenceStatusCodes.Offline, friend.PresenceStatus);
        Assert.Equal(lastSeenAt, friend.LastSeenAt);

        settings.PresenceVisibility = PresenceVisibilityCodes.Nobody;
        settings.PresenceMode = PresenceModeCodes.Automatic;
        await db.SaveChangesAsync();
        friend = await ResolveOneAsync(policy, viewerId, targetId);
        var self = await ResolveOneAsync(policy, targetId, targetId);
        Assert.Equal(UserPresenceSnapshot.Hidden, friend);
        Assert.Equal(PresenceStatusCodes.Online, self.PresenceStatus);
        Assert.Equal(lastSeenAt, self.LastSeenAt);

        await db.Database.ExecuteSqlRawAsync("PRAGMA ignore_check_constraints = ON");
        var corruptCode = "corrupt";
        await db.Database.ExecuteSqlAsync(
            $"UPDATE user_profile_settings SET presence_visibility = {corruptCode}, presence_mode = {corruptCode} WHERE user_id = {targetId}");
        db.ChangeTracker.Clear();

        anonymous = await ResolveOneAsync(policy, null, targetId);
        self = await ResolveOneAsync(policy, targetId, targetId);
        Assert.Equal(UserPresenceSnapshot.Hidden, anonymous);
        Assert.Equal(PresenceStatusCodes.Offline, self.PresenceStatus);
        Assert.Equal(lastSeenAt, self.LastSeenAt);

        var persistedSettings = await db.UserProfileSettings.SingleAsync(
            row => row.UserId == targetId);
        db.UserProfileSettings.Remove(persistedSettings);
        await db.SaveChangesAsync();

        anonymous = await ResolveOneAsync(policy, null, targetId);
        Assert.Equal(PresenceStatusCodes.Online, anonymous.PresenceStatus);
        Assert.Equal(lastSeenAt, anonymous.LastSeenAt);

        var recreatedSettings = await scope.ServiceProvider
            .GetRequiredService<IUserProfileSettingsService>()
            .GetProfileSettingsAsync(targetId);
        Assert.NotNull(recreatedSettings);
        Assert.Equal(
            PresenceVisibilityCodes.Everyone,
            recreatedSettings.PresenceVisibility);
        Assert.True(recreatedSettings.ShowLastSeen);
        Assert.Equal(PresenceModeCodes.Automatic, recreatedSettings.PresenceMode);
    }

    [Fact]
    public async Task Policy_FriendsVisibility_RequiresAcceptedSourceRequest()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var policy = scope.ServiceProvider.GetRequiredService<IUserPresencePolicyService>();
        var registry = scope.ServiceProvider.GetRequiredService<RealtimeConnectionRegistry>();
        var targetId = ArcaneLinkApiFactory.OutsiderUserId;
        var viewerId = ArcaneLinkApiFactory.OwnerUserId;
        var lastSeenAt = new DateTime(2026, 7, 21, 9, 45, 0, DateTimeKind.Utc);
        var target = await db.Users.SingleAsync(user => user.Id == targetId);
        var settings = await db.UserProfileSettings.SingleAsync(x => x.UserId == targetId);
        target.LastSeenAt = lastSeenAt;
        settings.PresenceVisibility = PresenceVisibilityCodes.Friends;
        settings.ShowLastSeen = true;
        settings.PresenceMode = PresenceModeCodes.Automatic;
        await AddFriendshipAsync(
            db,
            viewerId,
            targetId,
            FriendRequestStatusIds.Declined);
        registry.Register(targetId, $"presence-declined-friend-{Guid.NewGuid():N}");

        var snapshot = await ResolveOneAsync(policy, viewerId, targetId);

        Assert.Equal(UserPresenceSnapshot.Hidden, snapshot);
    }

    [Fact]
    public async Task HiddenPresence_DoesNotLeakAcrossProfileDiscoveryFriendPrivateOrServerSurfaces()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var rawLastSeenAt = new DateTime(2026, 7, 21, 10, 0, 0, DateTimeKind.Utc);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.Users.SingleAsync(
                user => user.Id == ArcaneLinkApiFactory.MemberUserId);
            var settings = await db.UserProfileSettings.SingleAsync(
                row => row.UserId == ArcaneLinkApiFactory.MemberUserId);
            member.LastSeenAt = rawLastSeenAt;
            settings.PresenceVisibility = PresenceVisibilityCodes.Nobody;
            settings.ShowLastSeen = true;
            settings.PresenceMode = PresenceModeCodes.Automatic;
            await AddFriendshipAsync(
                db,
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.MemberUserId);
            await db.SaveChangesAsync();
        }

        factory.Services
            .GetRequiredService<RealtimeConnectionRegistry>()
            .Register(
                ArcaneLinkApiFactory.MemberUserId,
                $"presence-leak-{Guid.NewGuid():N}");

        var directResponse = await client.PostAsync(
            $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
            content: null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(directResponse);
        var direct = await directResponse.Content.ReadFromJsonAsync<PrivateSpaceResponse>();
        Assert.NotNull(direct);

        var profile = await client.GetFromJsonAsync<PublicUserProfileResponse>(
            $"/api/users/{ArcaneLinkApiFactory.MemberUserId}");
        var search = await client.GetFromJsonAsync<List<FriendUserResponse>>(
            "/api/users/search?query=member");
        var friends = await client.GetFromJsonAsync<List<UserFriendResponse>>(
            "/api/friends");
        var privateSpace = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            $"/api/private-spaces/{direct.SpaceId}");
        var serverMembers = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members");
        var discoveredServers = await client.GetFromJsonAsync<List<ServerDiscoveryResponse>>(
            "/api/servers/discover?visibility=member&sort=name");

        AssertHidden(profile!);
        AssertHidden(Assert.Single(search!, user =>
            user.Id == ArcaneLinkApiFactory.MemberUserId));
        AssertHidden(Assert.Single(friends!).Friend);
        AssertHidden(Assert.Single(privateSpace!.Members, member =>
            member.UserId == ArcaneLinkApiFactory.MemberUserId).User);
        AssertHidden(Assert.Single(serverMembers!.Items, member =>
            member.UserId == ArcaneLinkApiFactory.MemberUserId).User);
        Assert.Equal(0, Assert.Single(discoveredServers!).OnlineMemberCount);
    }

    [Fact]
    public async Task ActiveMemberWithBanMetadata_IsExcludedFromServerMemberAndCountSurfaces()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(
                candidate => candidate.Id == ArcaneLinkApiFactory.MemberMemberId);
            member.StatusId = ServerMemberStatusIds.Active;
            member.BannedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        factory.Services
            .GetRequiredService<RealtimeConnectionRegistry>()
            .Register(
                ArcaneLinkApiFactory.MemberUserId,
                $"presence-active-banned-{Guid.NewGuid():N}");

        using var linkInviteResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest { KindCode = "link" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(linkInviteResponse);
        var linkInvite = await linkInviteResponse.Content
            .ReadFromJsonAsync<ServerInviteResponse>();
        Assert.NotNull(linkInvite?.Code);

        var serverMembers = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members");
        var discoveredServers = await client.GetFromJsonAsync<List<ServerDiscoveryResponse>>(
            "/api/servers/discover?visibility=member&sort=name");
        var preview = await client.GetFromJsonAsync<ServerInvitePreviewResponse>(
            $"/api/server-invites/{linkInvite.Code}");

        Assert.DoesNotContain(serverMembers!.Items, member =>
            member.UserId == ArcaneLinkApiFactory.MemberUserId);
        var discoveredServer = Assert.Single(discoveredServers!);
        Assert.Equal(1, discoveredServer.MemberCount);
        Assert.Equal(0, discoveredServer.OnlineMemberCount);
        Assert.NotNull(preview);
        Assert.Equal(1, preview.MemberCount);
        Assert.Equal(0, preview.OnlineCount);

        using var directInviteResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest
            {
                KindCode = "direct",
                TargetUserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(directInviteResponse);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var directInvites = await client.GetFromJsonAsync<List<ServerInviteResponse>>(
            "/api/server-invites/me");
        var directInvite = Assert.Single(directInvites!, invite =>
            invite.ServerId == ArcaneLinkApiFactory.ServerId);
        Assert.Equal(1, directInvite.MemberCount);
        Assert.Equal(0, directInvite.OnlineCount);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var targetServers = await client.GetFromJsonAsync<List<ServerMemberResponse>>(
            "/api/server-invites/target-servers");
        Assert.DoesNotContain(targetServers!, membership =>
            membership.ServerId == ArcaneLinkApiFactory.ServerId);
    }

    private static async Task<UserPresenceSnapshot> ResolveOneAsync(
        IUserPresencePolicyService policy,
        Guid? viewerUserId,
        Guid targetUserId)
    {
        var snapshots = await policy.ResolveAsync(viewerUserId, [targetUserId]);
        return snapshots[targetUserId];
    }

    private static async Task AddFriendshipAsync(
        AppDbContext db,
        Guid firstUserId,
        Guid secondUserId,
        Guid? requestStatusId = null)
    {
        if (await db.UserFriends.AnyAsync(friend =>
                friend.UserId == firstUserId &&
                friend.FriendUserId == secondUserId))
        {
            return;
        }

        var now = DateTime.UtcNow;
        var request = new FriendRequest
        {
            Id = Guid.NewGuid(),
            FromUserId = firstUserId,
            ToUserId = secondUserId,
            StatusId = requestStatusId ?? FriendRequestStatusIds.Accepted,
            CreatedAt = now,
            UpdatedAt = now,
            RespondedAt = now
        };
        db.FriendRequests.Add(request);
        db.UserFriends.AddRange(
            new UserFriend
            {
                UserId = firstUserId,
                FriendUserId = secondUserId,
                CreatedByRequestId = request.Id,
                CreatedAt = now
            },
            new UserFriend
            {
                UserId = secondUserId,
                FriendUserId = firstUserId,
                CreatedByRequestId = request.Id,
                CreatedAt = now
            });
        await db.SaveChangesAsync();
    }

    private static void AssertHidden(PublicUserProfileResponse user)
    {
        Assert.Equal(PresenceStatusCodes.Offline, user.PresenceStatus);
        Assert.Null(user.LastSeenAt);
    }

    private static void AssertHidden(FriendUserResponse user)
    {
        Assert.Equal(PresenceStatusCodes.Offline, user.PresenceStatus);
        Assert.Null(user.LastSeenAt);
    }

    private static void AssertHidden(ServerMemberUserResponse user)
    {
        Assert.Equal(PresenceStatusCodes.Offline, user.PresenceStatus);
        Assert.Null(user.LastSeenAt);
    }
}
