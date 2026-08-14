using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.NotificationsModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerBanIntegrationTests
{
    private static readonly Guid OutsiderMemberId =
        Guid.Parse("cccccccc-0000-0000-0000-000000000003");

    [Fact]
    public async Task BanLifecycle_RevokesAccessRolesAndDirectInvites_AndBlocksInviteBypass()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var role = await CreateRoleAsync(
            client,
            "Member helper",
            ["view_audit_log"],
            level: 20);
        var assignment = await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            role.Id);
        var linkInvite = await CreateInviteAsync(
            client,
            new CreateServerInviteRequest { KindCode = "link" });
        var directInviteId = Guid.NewGuid();
        var inviteNotificationId = Guid.NewGuid();
        Guid aclRevisionBeforeBan;

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            db.ServerInvites.Add(new ServerInvite
            {
                Id = directInviteId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                CreatedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                KindId = ServerGovernanceIds.InviteKindDirect,
                TargetUserId = ArcaneLinkApiFactory.MemberUserId,
                MaxUses = 1,
                UsedCount = 0,
                ExpiresAt = now.AddDays(1),
                CreatedAt = now
            });
            db.UserNotifications.Add(new UserNotification
            {
                Id = inviteNotificationId,
                UserId = ArcaneLinkApiFactory.MemberUserId,
                Kind = "server_invite",
                Title = "Server invite",
                Body = "Test Server",
                ActorUserId = ArcaneLinkApiFactory.OwnerUserId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                InviteId = directInviteId,
                CreatedAt = now
            });
            await db.SaveChangesAsync();
            aclRevisionBeforeBan = await db.Servers
                .Where(x => x.Id == ArcaneLinkApiFactory.ServerId)
                .Select(x => x.SpaceAclRevision)
                .SingleAsync();
        }

        using var banResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/ban",
            new BanServerMemberRequest { Reason = "  Repeated harassment  " });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(banResponse);
        var ban = await banResponse.Content.ReadFromJsonAsync<ServerBanResponse>();

        Assert.NotNull(ban);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, ban.BannedByUserId);
        Assert.Equal("Repeated harassment", ban.Reason);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(
                x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
            var storedAssignment = await db.ServerMemberRoles.SingleAsync(
                x => x.Id == assignment.Id);
            var directInvite = await db.ServerInvites.SingleAsync(
                x => x.Id == directInviteId);
            var inviteNotification = await db.UserNotifications.SingleAsync(
                x => x.Id == inviteNotificationId);
            var aclRevisionAfterBan = await db.Servers
                .Where(x => x.Id == ArcaneLinkApiFactory.ServerId)
                .Select(x => x.SpaceAclRevision)
                .SingleAsync();

            Assert.Equal(ServerMemberStatusIds.Banned, member.StatusId);
            Assert.NotNull(member.BannedAt);
            Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, member.BannedByUserId);
            Assert.Equal("Repeated harassment", member.BanReason);
            Assert.Equal(member.BannedAt, member.LeftAt);
            Assert.NotNull(storedAssignment.RevokedAt);
            Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, storedAssignment.RevokedByUserId);
            Assert.NotNull(directInvite.RevokedAt);
            Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, directInvite.RevokedByUserId);
            Assert.NotNull(inviteNotification.ReadAt);
            Assert.NotEqual(aclRevisionBeforeBan, aclRevisionAfterBan);
            Assert.Contains(
                await db.ServerAuditLogs.ToListAsync(),
                audit =>
                    audit.EventTypeId == ServerGovernanceIds.AuditMemberBanned &&
                    audit.TargetUserId == ArcaneLinkApiFactory.MemberUserId);
        }

        var listedBans = await client.GetFromJsonAsync<List<ServerBanResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/bans");
        var listedBan = Assert.Single(listedBans!);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, listedBan.BannedByUserId);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var directAcceptResponse = await client.PostAsync(
                   $"/api/server-invites/{directInviteId}/accept",
                   content: null))
        {
            Assert.Equal(HttpStatusCode.NotFound, directAcceptResponse.StatusCode);
        }
        using (var linkAcceptResponse = await client.PostAsJsonAsync(
                   "/api/server-invites/accept",
                   new AcceptServerInviteRequest { Code = linkInvite.Code! }))
        {
            Assert.Equal(HttpStatusCode.NotFound, linkAcceptResponse.StatusCode);
        }
        using (var unauthorizedListResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/bans"))
        {
            Assert.Equal(HttpStatusCode.NotFound, unauthorizedListResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var inviteBannedMemberResponse = await client.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
                   new CreateServerInviteRequest
                   {
                       KindCode = "direct",
                       TargetUserId = ArcaneLinkApiFactory.MemberUserId
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, inviteBannedMemberResponse.StatusCode);
        }

        using var unbanResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/bans/{ArcaneLinkApiFactory.MemberMemberId}");
        Assert.Equal(HttpStatusCode.NoContent, unbanResponse.StatusCode);

        var bansAfterUnban = await client.GetFromJsonAsync<List<ServerBanResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/bans");
        Assert.Empty(bansAfterUnban!);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(
                x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
            Assert.Equal(ServerMemberStatusIds.Removed, member.StatusId);
            Assert.Null(member.BannedAt);
            Assert.Null(member.BannedByUserId);
            Assert.Null(member.BanReason);
            Assert.Contains(
                await db.ServerAuditLogs.ToListAsync(),
                audit =>
                    audit.EventTypeId == ServerGovernanceIds.AuditMemberUnbanned &&
                    audit.TargetUserId == ArcaneLinkApiFactory.MemberUserId);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var rejoinResponse = await client.PostAsJsonAsync(
            "/api/server-invites/accept",
            new AcceptServerInviteRequest { Code = linkInvite.Code! });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(rejoinResponse);
        var rejoinedMember = await rejoinResponse.Content
            .ReadFromJsonAsync<ServerMemberResponse>();
        Assert.Equal("active", rejoinedMember?.StatusCode);
        Assert.True(rejoinedMember?.JoinedAt > ban.BannedAt);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedAssignment = await db.ServerMemberRoles.SingleAsync(
                x => x.Id == assignment.Id);
            Assert.NotNull(storedAssignment.RevokedAt);
        }
    }

    [Fact]
    public async Task AcceptingInvite_AsActiveMember_DoesNotResetJoinedAt()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var linkInvite = await CreateInviteAsync(
            client,
            new CreateServerInviteRequest { KindCode = "link" });
        var originalJoinedAt = new DateTime(
            2025,
            1,
            2,
            3,
            4,
            5,
            DateTimeKind.Utc);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(
                x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
            member.JoinedAt = originalJoinedAt;
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var acceptResponse = await client.PostAsJsonAsync(
            "/api/server-invites/accept",
            new AcceptServerInviteRequest { Code = linkInvite.Code! });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(acceptResponse);
        var acceptedMember = await acceptResponse.Content
            .ReadFromJsonAsync<ServerMemberResponse>();

        Assert.Equal(originalJoinedAt, acceptedMember?.JoinedAt);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storedMember = await db.ServerMembers
                .AsNoTracking()
                .SingleAsync(x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
            Assert.Equal(originalJoinedAt, storedMember.JoinedAt);
        }
    }

    [Fact]
    public async Task DelegatedModerator_CannotBanSelfOwnerEqualOrManageServerMember()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddOutsiderMembershipAsync(factory);
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var moderatorRole = await CreateRoleAsync(
            client,
            "Moderator",
            ["manage_members"],
            level: 10);
        var targetRole = await CreateRoleAsync(
            client,
            "Target",
            [],
            level: 10);
        await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            moderatorRole.Id);
        await AssignRoleAsync(client, OutsiderMemberId, targetRole.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertBanStatusAsync(
            client,
            OutsiderMemberId,
            HttpStatusCode.NotFound);
        await AssertBanStatusAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            HttpStatusCode.NotFound);
        await AssertBanStatusAsync(
            client,
            ArcaneLinkApiFactory.OwnerMemberId,
            HttpStatusCode.BadRequest);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.ServerRoles.SingleAsync(x => x.Id == targetRole.Id);
            role.Level = 20;
            db.ServerRolePermissions.Add(new ServerRolePermission
            {
                RoleId = targetRole.Id,
                PermissionId = ServerGovernanceIds.PermissionManageServer,
                IsGranted = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        await AssertBanStatusAsync(
            client,
            OutsiderMemberId,
            HttpStatusCode.NotFound);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var grants = await db.ServerRolePermissions
                .Where(x =>
                    x.RoleId == targetRole.Id &&
                    x.PermissionId == ServerGovernanceIds.PermissionManageServer)
                .ToListAsync();
            db.ServerRolePermissions.RemoveRange(grants);
            await db.SaveChangesAsync();
        }

        await AssertBanStatusAsync(client, OutsiderMemberId, HttpStatusCode.OK);
    }

    [Fact]
    public async Task RemoveMember_RevokesEveryActiveRoleAssignment()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Temporary role", [], level: 20);
        var assignment = await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            role.Id);

        using var response = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedAssignment = await db.ServerMemberRoles.SingleAsync(
            x => x.Id == assignment.Id);
        Assert.NotNull(storedAssignment.RevokedAt);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, storedAssignment.RevokedByUserId);
    }

    [Fact]
    public async Task BanList_PreservesUnknownActorForLegacyBannedMembership()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var legacyUpdatedAt = DateTime.UtcNow.AddDays(-5);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var member = await db.ServerMembers.SingleAsync(
                x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
            member.StatusId = ServerMemberStatusIds.Banned;
            member.LeftAt = legacyUpdatedAt;
            member.BannedAt = null;
            member.BannedByUserId = null;
            member.BanReason = null;
            member.UpdatedAt = legacyUpdatedAt;
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var bans = await client.GetFromJsonAsync<List<ServerBanResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/bans");
        var ban = Assert.Single(bans!);

        Assert.Null(ban.BannedByUserId);
        Assert.Equal(legacyUpdatedAt, ban.BannedAt, TimeSpan.FromSeconds(1));
        Assert.Equal(string.Empty, ban.Reason);
    }

    [Fact]
    public async Task RealtimeFailure_DoesNotTurnCommittedBanIntoHttpError()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IRealtimeNotificationService>();
                services.AddScoped<
                    IRealtimeNotificationService,
                    ThrowingRealtimeNotificationService>();
            });
        });
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.MemberMemberId}/ban",
            new BanServerMemberRequest { Reason = "Committed before delivery" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var member = await db.ServerMembers.SingleAsync(
            x => x.Id == ArcaneLinkApiFactory.MemberMemberId);
        Assert.Equal(ServerMemberStatusIds.Banned, member.StatusId);
        Assert.Equal("Committed before delivery", member.BanReason);
    }

    private static async Task AssertBanStatusAsync(
        HttpClient client,
        Guid memberId,
        HttpStatusCode expectedStatus)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{memberId}/ban",
            new BanServerMemberRequest { Reason = "Moderation reason" });
        Assert.Equal(expectedStatus, response.StatusCode);
    }

    private static async Task AddOutsiderMembershipAsync(ArcaneLinkApiFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        db.ServerMembers.Add(new ServerMember
        {
            Id = OutsiderMemberId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            UserId = ArcaneLinkApiFactory.OutsiderUserId,
            StatusId = ServerMemberStatusIds.Active,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title,
        IReadOnlyList<string> permissionCodes,
        int level)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                Level = level,
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerMemberRoleResponse> AssignRoleAsync(
        HttpClient client,
        Guid memberId,
        Guid roleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{memberId}/roles",
            new AssignServerRoleRequest { RoleId = roleId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerMemberRoleResponse>())!;
    }

    private static async Task<ServerInviteResponse> CreateInviteAsync(
        HttpClient client,
        CreateServerInviteRequest request)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            request);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerInviteResponse>())!;
    }

    private sealed class ThrowingRealtimeNotificationService
        : IRealtimeNotificationService
    {
        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return CreateResult(eventName);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return CreateResult(eventName);
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return CreateResult(eventName);
        }

        private static Task CreateResult(string eventName)
        {
            return eventName is
                RealtimeEventNames.ServerGovernanceChanged or
                RealtimeEventNames.ServerMembersChanged or
                RealtimeEventNames.UserServersChanged
                    ? Task.FromException(
                        new InvalidOperationException(
                            "Injected realtime failure."))
                    : Task.CompletedTask;
        }
    }
}
