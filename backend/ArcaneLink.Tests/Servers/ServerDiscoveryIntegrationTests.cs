using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerDiscoveryIntegrationTests
{
    [Fact]
    public async Task MemberVisibility_ReturnsCurrentUsersServerWithMembership()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var servers = await DiscoverAsync(
            client,
            "/api/servers/discover?visibility=member&sort=name");

        var server = Assert.Single(servers);
        Assert.Equal(ArcaneLinkApiFactory.ServerId, server.Server.Id);
        Assert.True(server.IsMember);
        Assert.Equal(ArcaneLinkApiFactory.OwnerMemberId, server.MembershipId);
        Assert.NotNull(server.JoinedAt);
        Assert.Equal(2, server.MemberCount);
        Assert.Equal(1, server.TextSpaceCount);
        Assert.Equal(0, server.VoiceSpaceCount);
        Assert.Equal(0, server.FriendCount);
        Assert.Empty(server.CurrentUserRoleTitles);
    }

    [Fact]
    public async Task AvailableVisibility_ReturnsPublicServerForNonMember()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await MakeSeededServerPublicAsync(factory);
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        var servers = await DiscoverAsync(
            client,
            "/api/servers/discover?visibility=available&query=Test%20Server");

        var server = Assert.Single(servers);
        Assert.Equal(ArcaneLinkApiFactory.ServerId, server.Server.Id);
        Assert.False(server.IsMember);
        Assert.Null(server.MembershipId);
        Assert.Null(server.JoinedAt);
        Assert.Null(server.Server.DefaultTextSpaceId);
        Assert.Equal(0, server.TextSpaceCount);
        Assert.Equal(0, server.VoiceSpaceCount);
        Assert.Equal(0, server.FriendCount);
        Assert.Empty(server.CurrentUserRoleTitles);
    }

    [Fact]
    public async Task MemberDiscovery_ReturnsVisibleSpaceCountsActiveRolesAndActiveFriends()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var joinedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        await SeedDetailedDiscoveryDataAsync(factory, joinedAt);
        client.AuthorizeWith(await client.LoginAsync("member"));

        var servers = await DiscoverAsync(
            client,
            "/api/servers/discover?visibility=member&sort=name");

        var server = Assert.Single(servers);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, server.MembershipId);
        Assert.Equal(joinedAt, server.JoinedAt);
        Assert.Equal(2, server.MemberCount);
        Assert.Equal(1, server.TextSpaceCount);
        Assert.Equal(1, server.VoiceSpaceCount);
        Assert.Equal(1, server.FriendCount);
        Assert.Equal(
            ["Navigator", "Crew"],
            server.CurrentUserRoleTitles);
    }

    [Fact]
    public async Task GranularViewPermissions_GateSpaceCountsAndDefaultSpace()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var withoutTextView =
                ServerPermissionRegistry.DefaultEveryonePermissionsMask.Without(
                    ServerPermissionRegistry.GetRequired("VIEW_TEXT_SPACES").Bit);
            db.ServerRoles.Add(new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "everyone",
                Title = "@everyone",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                PermissionMask = ServerRolePermissionMaskCodec.Encode(withoutTextView),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            });
            db.Spaces.Add(CreateSpace(
                "granular-voice-visible",
                SpaceIds.TypeVoiceRoom,
                now));
            var server = await db.Servers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.ServerId);
            server.AuthorizationVersion = Guid.NewGuid();
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));
        var discovered = Assert.Single(await DiscoverAsync(
            client,
            "/api/servers/discover?visibility=member&sort=name"));

        Assert.Equal(0, discovered.TextSpaceCount);
        Assert.Equal(1, discovered.VoiceSpaceCount);
        Assert.Null(discovered.Server.DefaultTextSpaceId);

        var memberships = await client.GetFromJsonAsync<List<ServerMemberResponse>>(
            "/api/servers/me");
        Assert.Null(Assert.Single(memberships!).Server.DefaultTextSpaceId);
    }

    private static async Task<List<ServerDiscoveryResponse>> DiscoverAsync(
        HttpClient client,
        string requestUri)
    {
        var response = await client.GetAsync(requestUri);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        return await response.Content
            .ReadFromJsonAsync<List<ServerDiscoveryResponse>>() ?? [];
    }

    private static async Task MakeSeededServerPublicAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.SingleAsync(
            x => x.Id == ArcaneLinkApiFactory.ServerId);
        server.AccessMode = ServerAccessModeCodes.Public;
        await db.SaveChangesAsync();
    }

    private static async Task SeedDetailedDiscoveryDataAsync(
        ArcaneLinkApiFactory factory,
        DateTime joinedAt)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;

        var member = await db.ServerMembers.SingleAsync(
            x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
        member.JoinedAt = joinedAt;
        member.UpdatedAt = now;

        var navigatorRole = CreateRole("Navigator", 20, now);
        var crewRole = CreateRole("Crew", 10, now);
        var hiddenRole = CreateRole("Hidden", 30, now);
        var revokedRole = CreateRole("Revoked", 40, now);
        var deletedRole = CreateRole("Deleted", 50, now);
        deletedRole.DeletedAt = now;
        db.ServerRoles.AddRange(
            navigatorRole,
            crewRole,
            hiddenRole,
            revokedRole,
            deletedRole);
        db.ServerMemberRoles.AddRange(
            CreateRoleAssignment(member.Id, navigatorRole.Id, now),
            CreateRoleAssignment(member.Id, crewRole.Id, now),
            CreateRoleAssignment(member.Id, revokedRole.Id, now, now),
            CreateRoleAssignment(member.Id, deletedRole.Id, now));

        db.Spaces.AddRange(
            CreateSpace("voice-visible", SpaceIds.TypeVoiceRoom, now),
            CreateSpace(
                "text-hidden",
                SpaceIds.TypeTextRoom,
                now,
                requiredRoleId: hiddenRole.Id),
            CreateSpace(
                "voice-hidden",
                SpaceIds.TypeVoiceRoom,
                now,
                requiredRoleId: hiddenRole.Id),
            CreateSpace(
                "text-deleted",
                SpaceIds.TypeTextRoom,
                now,
                deletedAt: now),
            CreateSpace(
                "voice-deleted",
                SpaceIds.TypeVoiceRoom,
                now,
                deletedAt: now));

        db.ServerMembers.Add(new ServerMember
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = ServerMemberStatusIds.Active,
            JoinedAt = now,
            BannedAt = now,
            BannedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            BanReason = "Discovery aggregate test",
            CreatedAt = now,
            UpdatedAt = now
        });
        AddFriendship(
            db,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OwnerUserId,
            now);
        AddFriendship(
            db,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId,
            now);

        await db.SaveChangesAsync();
    }

    private static ServerRole CreateRole(
        string title,
        int level,
        DateTime now)
    {
        return new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = title,
            Level = level,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static ServerMemberRole CreateRoleAssignment(
        Guid memberId,
        Guid roleId,
        DateTime now,
        DateTime? revokedAt = null)
    {
        return new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = memberId,
            RoleId = roleId,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now,
            RevokedAt = revokedAt,
            RevokedByUserId = revokedAt.HasValue
                ? ArcaneLinkApiFactory.OwnerUserId
                : null
        };
    }

    private static Space CreateSpace(
        string title,
        Guid typeId,
        DateTime now,
        Guid? requiredRoleId = null,
        DateTime? deletedAt = null)
    {
        return new Space
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            TypeId = typeId,
            CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            Title = title,
            RequiredServerRoleId = requiredRoleId,
            Position = 1,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now,
            DeletedAt = deletedAt
        };
    }

    private static void AddFriendship(
        AppDbContext db,
        Guid firstUserId,
        Guid secondUserId,
        DateTime now)
    {
        var request = new FriendRequest
        {
            Id = Guid.NewGuid(),
            FromUserId = firstUserId,
            ToUserId = secondUserId,
            StatusId = FriendRequestStatusIds.Accepted,
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
    }
}
