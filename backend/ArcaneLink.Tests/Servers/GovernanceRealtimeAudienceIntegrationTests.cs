using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Servers;

public sealed class GovernanceRealtimeAudienceIntegrationTests
{
    [Fact]
    public async Task InviteRealtime_IsLimitedToOwnerAndExactInviteAudience()
    {
        var realtime = new RecordingRealtime();
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IRealtimeNotificationService>();
            services.AddSingleton<IRealtimeNotificationService>(realtime);
        });
        using var client = factory.CreateClient();
        await GrantGranularPermissionsAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ["CREATE_INVITES"]);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        realtime.Clear();
        using (var ownerCreate = await client.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
                   new CreateServerInviteRequest { KindCode = "link" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(ownerCreate);
        }

        AssertAudience(
            realtime,
            RealtimeEventNames.ServerGovernanceChanged,
            [ArcaneLinkApiFactory.OwnerUserId]);

        client.AuthorizeWith(await client.LoginAsync("member"));
        realtime.Clear();
        using (var memberCreate = await client.PostAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
                   new CreateServerInviteRequest { KindCode = "link" }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(memberCreate);
        }

        AssertAudience(
            realtime,
            RealtimeEventNames.ServerGovernanceChanged,
            [
                ArcaneLinkApiFactory.OwnerUserId,
                ArcaneLinkApiFactory.MemberUserId
            ]);
        Assert.DoesNotContain(realtime.Calls, call => call.ServerId != null);
    }

    [Fact]
    public async Task JoinRequestRealtime_UsesExactApprovalAudience()
    {
        var realtime = new RecordingRealtime();
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IRealtimeNotificationService>();
            services.AddSingleton<IRealtimeNotificationService>(realtime);
        });
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        realtime.Clear();
        using (var joinResponse = await client.PostAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(joinResponse);
        }

        AssertAudience(
            realtime,
            RealtimeEventNames.ServerJoinRequestsChanged,
            [ArcaneLinkApiFactory.OwnerUserId]);
        AssertAudience(
            realtime,
            RealtimeEventNames.ServerGovernanceChanged,
            [ArcaneLinkApiFactory.OwnerUserId]);

        await GrantGranularPermissionsAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ["APPROVE_JOIN_REQUESTS"]);
        realtime.Clear();
        using (var cancelResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join-requests/me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);
        }

        var expectedReviewers = new[]
        {
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.MemberUserId
        };
        AssertAudience(
            realtime,
            RealtimeEventNames.ServerJoinRequestsChanged,
            expectedReviewers);
        AssertAudience(
            realtime,
            RealtimeEventNames.ServerGovernanceChanged,
            expectedReviewers);
        Assert.DoesNotContain(realtime.Calls, call => call.ServerId != null);
    }

    private static void AssertAudience(
        RecordingRealtime realtime,
        string eventName,
        IReadOnlyCollection<Guid> expectedUserIds)
    {
        var call = Assert.Single(
            realtime.Calls,
            call => call.EventName == eventName);
        Assert.Equal(
            expectedUserIds.OrderBy(userId => userId),
            call.UserIds.OrderBy(userId => userId));
        Assert.Null(call.ServerId);
    }

    private static async Task SetRestrictedAsync(ArcaneLinkApiFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.SingleAsync(server =>
            server.Id == ArcaneLinkApiFactory.ServerId);
        server.AccessMode = ServerAccessModeCodes.Restricted;
        await db.SaveChangesAsync();
    }

    private static async Task GrantGranularPermissionsAsync(
        ArcaneLinkApiFactory factory,
        Guid memberId,
        IReadOnlyCollection<string> permissionCodes)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"Realtime audience {Guid.NewGuid():N}",
            Level = 20,
            IsSystem = false,
            PermissionMask = ServerRolePermissionMaskCodec.Encode(
                ServerPermissionRegistry.CreateMask(permissionCodes)),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = memberId,
            RoleId = role.Id,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });

        var member = await db.ServerMembers.SingleAsync(candidate =>
            candidate.Id == memberId);
        member.RolesVersion = Guid.NewGuid();
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        var authorizationVersion = Guid.NewGuid();
        server.AuthorizationVersion = authorizationVersion;
        server.SpaceAclRevision = authorizationVersion;
        await db.SaveChangesAsync();
    }

    private sealed class RecordingRealtime : IRealtimeNotificationService
    {
        private readonly object _sync = new();
        private readonly List<RealtimeCall> _calls = [];

        public IReadOnlyList<RealtimeCall> Calls
        {
            get
            {
                lock (_sync)
                {
                    return _calls.ToList();
                }
            }
        }

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync([userId], null, eventName);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync(userIds.Distinct().ToList(), null, eventName);
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync([], serverId, eventName);
        }

        public void Clear()
        {
            lock (_sync)
            {
                _calls.Clear();
            }
        }

        private Task RecordAsync(
            IReadOnlyList<Guid> userIds,
            Guid? serverId,
            string eventName)
        {
            lock (_sync)
            {
                _calls.Add(new RealtimeCall(userIds, serverId, eventName));
            }

            return Task.CompletedTask;
        }
    }

    private sealed record RealtimeCall(
        IReadOnlyList<Guid> UserIds,
        Guid? ServerId,
        string EventName);
}
