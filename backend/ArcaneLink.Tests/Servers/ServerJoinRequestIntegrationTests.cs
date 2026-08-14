using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerJoinRequestIntegrationTests
{
    [Fact]
    public async Task RestrictedServer_CreatesOnePendingRequestAndReflectsItInDiscovery()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        client.AuthorizeWith(await client.LoginAsync("outsider"));

        var first = await JoinAsync(client);
        var second = await JoinAsync(client);

        Assert.Equal(ServerJoinResultStatusCodes.Pending, first.Status);
        Assert.Null(first.Membership);
        Assert.NotNull(first.JoinRequest);
        Assert.Equal(
            ServerJoinRequestStatusCodes.Pending,
            first.JoinRequest.StatusCode);
        Assert.Equal(ArcaneLinkApiFactory.OutsiderUserId, first.JoinRequest.UserId);
        Assert.Equal("outsider", first.JoinRequest.User.Login);
        Assert.Equal(first.JoinRequest.Id, second.JoinRequest?.Id);

        var discovery = await client.GetFromJsonAsync<List<ServerDiscoveryResponse>>(
            "/api/servers/discover?visibility=available&query=Test%20Server");
        var server = Assert.Single(discovery ?? []);
        Assert.Equal(ServerJoinActionCodes.Pending, server.JoinAction);
        Assert.Equal(
            first.JoinRequest.Id,
            server.CurrentUserJoinRequest?.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            1,
            await db.ServerJoinRequests.CountAsync(request =>
                request.ServerId == ArcaneLinkApiFactory.ServerId &&
                request.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                request.StatusCode == ServerJoinRequestStatusCodes.Pending));
        Assert.False(await db.ServerMembers.AnyAsync(member =>
            member.ServerId == ArcaneLinkApiFactory.ServerId &&
            member.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
            member.StatusId == ServerMemberStatusIds.Active));
    }

    [Fact]
    public async Task Requester_CanCancelPendingRequestAndRequestAgain()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);

        using (var cancelResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join-requests/me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);
        }
        using (var repeatedCancel = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join-requests/me"))
        {
            Assert.Equal(HttpStatusCode.NotFound, repeatedCancel.StatusCode);
        }

        var replacement = await JoinAsync(client);
        Assert.Equal(ServerJoinResultStatusCodes.Pending, replacement.Status);
        Assert.NotNull(replacement.JoinRequest);
        Assert.NotEqual(pending.Id, replacement.JoinRequest.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var requests = await db.ServerJoinRequests
            .AsNoTracking()
            .Where(request =>
                request.ServerId == ArcaneLinkApiFactory.ServerId &&
                request.UserId == ArcaneLinkApiFactory.OutsiderUserId)
            .OrderBy(request => request.CreatedAt)
            .ToListAsync();
        Assert.Equal(2, requests.Count);
        Assert.Equal(
            ServerJoinRequestStatusCodes.Cancelled,
            requests[0].StatusCode);
        Assert.Null(requests[0].ReviewedByUserId);
        Assert.NotNull(requests[0].ReviewedAt);
        Assert.Equal(
            ServerJoinRequestStatusCodes.Pending,
            requests[1].StatusCode);
    }

    [Theory]
    [InlineData(ServerAccessModeCodes.Public, 1)]
    [InlineData(ServerAccessModeCodes.Private, 0)]
    public async Task LeavingRestrictedMode_CancelsPendingRequests(
        string nextAccessMode,
        int expectedDiscoveryCount)
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var updateResponse = await client.PatchAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}",
                   new UpdateServerRequest { AccessMode = nextAccessMode }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.ServerJoinRequests
                .AsNoTracking()
                .SingleAsync(request => request.Id == pending.Id);
            Assert.Equal(
                ServerJoinRequestStatusCodes.Cancelled,
                stored.StatusCode);
            Assert.Equal(
                ArcaneLinkApiFactory.OwnerUserId,
                stored.ReviewedByUserId);
            Assert.NotNull(stored.ReviewedAt);
        }

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var discovery = await client
            .GetFromJsonAsync<List<ServerDiscoveryResponse>>(
                "/api/servers/discover?visibility=available&query=Test%20Server");
        Assert.Equal(expectedDiscoveryCount, discovery?.Count ?? 0);
        if (nextAccessMode == ServerAccessModeCodes.Public)
        {
            Assert.Equal(
                ServerJoinActionCodes.Join,
                Assert.Single(discovery ?? []).JoinAction);
        }
    }

    [Fact]
    public async Task Owner_CanPagePendingRequestsWithCompositeCursor()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);

        var now = DateTime.UtcNow;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ServerJoinRequests.AddRange(
                CreatePendingRequest(
                    ArcaneLinkApiFactory.OwnerUserId,
                    now.AddMinutes(-1)),
                CreatePendingRequest(
                    ArcaneLinkApiFactory.MemberUserId,
                    now.AddMinutes(-2)),
                CreatePendingRequest(
                    ArcaneLinkApiFactory.OutsiderUserId,
                    now.AddMinutes(-3)));
            await db.SaveChangesAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstPage = await client
            .GetFromJsonAsync<ServerJoinRequestPageResponse>(
                $"{JoinRequestsPath()}?limit=2");

        Assert.NotNull(firstPage);
        Assert.Equal(3, firstPage.TotalCount);
        Assert.Equal(2, firstPage.Items.Count);
        Assert.NotNull(firstPage.NextCursor);

        var cursor = firstPage.NextCursor;
        var secondPage = await client
            .GetFromJsonAsync<ServerJoinRequestPageResponse>(
                $"{JoinRequestsPath()}?limit=2" +
                $"&afterCreatedAt={Uri.EscapeDataString(cursor.CreatedAt.ToString("O"))}" +
                $"&afterId={cursor.Id}");

        Assert.NotNull(secondPage);
        Assert.Equal(3, secondPage.TotalCount);
        Assert.Single(secondPage.Items);
        Assert.Null(secondPage.NextCursor);
        Assert.Equal(
            3,
            firstPage.Items
                .Concat(secondPage.Items)
                .Select(request => request.Id)
                .Distinct()
                .Count());
    }

    [Fact]
    public async Task Owner_CanApprovePendingRequest()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var pendingPage = await client
            .GetFromJsonAsync<ServerJoinRequestPageResponse>(
                JoinRequestsPath());
        Assert.Equal(1, pendingPage?.TotalCount);
        Assert.Equal(pending.Id, Assert.Single(pendingPage?.Items ?? []).Id);

        using var approveResponse = await client.PostAsync(
            ApprovePath(pending.Id),
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(approveResponse);
        var membership = await approveResponse.Content
            .ReadFromJsonAsync<ServerMemberResponse>();

        Assert.Equal(ArcaneLinkApiFactory.OutsiderUserId, membership?.UserId);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, membership?.AddedByUserId);
        Assert.Equal("active", membership?.StatusCode);

        using (var repeatedApprove = await client.PostAsync(
                   ApprovePath(pending.Id),
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, repeatedApprove.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.ServerJoinRequests
            .AsNoTracking()
            .SingleAsync(request => request.Id == pending.Id);
        Assert.Equal(ServerJoinRequestStatusCodes.Approved, stored.StatusCode);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, stored.ReviewedByUserId);
        Assert.NotNull(stored.ReviewedAt);
        Assert.Equal(
            1,
            await db.ServerMembers.CountAsync(member =>
                member.ServerId == ArcaneLinkApiFactory.ServerId &&
                member.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                member.StatusId == ServerMemberStatusIds.Active));
    }

    [Fact]
    public async Task Owner_CanDeclinePendingRequestWithoutCreatingMembership()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var declineResponse = await client.PostAsync(
            DeclinePath(pending.Id),
            null);
        Assert.Equal(HttpStatusCode.NoContent, declineResponse.StatusCode);
        using (var repeatedDecline = await client.PostAsync(
                   DeclinePath(pending.Id),
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, repeatedDecline.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.ServerJoinRequests
            .AsNoTracking()
            .SingleAsync(request => request.Id == pending.Id);
        Assert.Equal(ServerJoinRequestStatusCodes.Declined, stored.StatusCode);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, stored.ReviewedByUserId);
        Assert.NotNull(stored.ReviewedAt);
        Assert.False(await db.ServerMembers.AnyAsync(member =>
            member.ServerId == ArcaneLinkApiFactory.ServerId &&
            member.UserId == ArcaneLinkApiFactory.OutsiderUserId));
    }

    [Fact]
    public async Task ManageMembersRole_CanDeclineAndApproveRequests()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        await GrantManageMembersAsync(factory);
        var firstPending = await CreatePendingRequestAsync(client);
        client.AuthorizeWith(await client.LoginAsync("member"));

        var pendingPage = await client
            .GetFromJsonAsync<ServerJoinRequestPageResponse>(
                JoinRequestsPath());
        Assert.Equal(firstPending.Id, Assert.Single(pendingPage?.Items ?? []).Id);
        using (var declineResponse = await client.PostAsync(
                   DeclinePath(firstPending.Id),
                   null))
        {
            Assert.Equal(HttpStatusCode.NoContent, declineResponse.StatusCode);
        }

        var secondPending = await CreatePendingRequestAsync(client);
        Assert.NotEqual(firstPending.Id, secondPending.Id);
        client.AuthorizeWith(await client.LoginAsync("member"));
        using var approveResponse = await client.PostAsync(
            ApprovePath(secondPending.Id),
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(approveResponse);
        var membership = await approveResponse.Content
            .ReadFromJsonAsync<ServerMemberResponse>();
        Assert.Equal(
            ArcaneLinkApiFactory.MemberUserId,
            membership?.AddedByUserId);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var requests = await db.ServerJoinRequests
            .AsNoTracking()
            .Where(request =>
                request.ServerId == ArcaneLinkApiFactory.ServerId &&
                request.UserId == ArcaneLinkApiFactory.OutsiderUserId)
            .OrderBy(request => request.CreatedAt)
            .ToListAsync();
        Assert.Contains(
            requests,
            request =>
                request.Id == firstPending.Id &&
                request.StatusCode == ServerJoinRequestStatusCodes.Declined &&
                request.ReviewedByUserId == ArcaneLinkApiFactory.MemberUserId);
        Assert.Contains(
            requests,
            request =>
                request.Id == secondPending.Id &&
                request.StatusCode == ServerJoinRequestStatusCodes.Approved &&
                request.ReviewedByUserId == ArcaneLinkApiFactory.MemberUserId);
    }

    [Fact]
    public async Task OrdinaryMember_CannotListApproveOrDeclineRequests()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);
        client.AuthorizeWith(await client.LoginAsync("member"));

        using (var listResponse = await client.GetAsync(JoinRequestsPath()))
        {
            Assert.Equal(HttpStatusCode.NotFound, listResponse.StatusCode);
        }
        using (var approveResponse = await client.PostAsync(
                   ApprovePath(pending.Id),
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, approveResponse.StatusCode);
        }
        using (var declineResponse = await client.PostAsync(
                   DeclinePath(pending.Id),
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, declineResponse.StatusCode);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.ServerJoinRequests
            .AsNoTracking()
            .SingleAsync(request => request.Id == pending.Id);
        Assert.Equal(ServerJoinRequestStatusCodes.Pending, stored.StatusCode);
        Assert.Null(stored.ReviewedAt);
        Assert.Null(stored.ReviewedByUserId);
    }

    [Theory]
    [InlineData("link")]
    [InlineData("direct")]
    public async Task InviteAcceptance_ApprovesExistingPendingRequest(
        string inviteKind)
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await SetRestrictedAsync(factory);
        var pending = await CreatePendingRequestAsync(client);
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var inviteResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/invites",
            new CreateServerInviteRequest
            {
                KindCode = inviteKind,
                TargetUserId = inviteKind == "direct"
                    ? ArcaneLinkApiFactory.OutsiderUserId
                    : null
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(inviteResponse);
        var invite = (await inviteResponse.Content
            .ReadFromJsonAsync<ServerInviteResponse>())!;

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var acceptResponse = inviteKind == "direct"
            ? await client.PostAsync(
                $"/api/server-invites/{invite.Id}/accept",
                null)
            : await client.PostAsJsonAsync(
                "/api/server-invites/accept",
                new AcceptServerInviteRequest { Code = invite.Code! });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(acceptResponse);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.ServerJoinRequests
            .AsNoTracking()
            .SingleAsync(request => request.Id == pending.Id);
        Assert.Equal(ServerJoinRequestStatusCodes.Approved, stored.StatusCode);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, stored.ReviewedByUserId);
        Assert.NotNull(stored.ReviewedAt);
        Assert.True(await db.ServerMembers.AnyAsync(member =>
            member.ServerId == ArcaneLinkApiFactory.ServerId &&
            member.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
            member.StatusId == ServerMemberStatusIds.Active));
    }

    private static async Task<ServerJoinRequestResponse>
        CreatePendingRequestAsync(HttpClient client)
    {
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var response = await JoinAsync(client);
        Assert.Equal(ServerJoinResultStatusCodes.Pending, response.Status);
        return Assert.IsType<ServerJoinRequestResponse>(response.JoinRequest);
    }

    private static async Task<ServerJoinResponse> JoinAsync(HttpClient client)
    {
        using var response = await client.PostAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerJoinResponse>())!;
    }

    private static async Task SetRestrictedAsync(ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers.SingleAsync(
            candidate => candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AccessMode = ServerAccessModeCodes.Restricted;
        await db.SaveChangesAsync();
    }

    private static ServerJoinRequest CreatePendingRequest(
        Guid userId,
        DateTime createdAt)
    {
        return new ServerJoinRequest
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            UserId = userId,
            StatusCode = ServerJoinRequestStatusCodes.Pending,
            CreatedAt = createdAt,
            UpdatedAt = createdAt
        };
    }

    private static async Task GrantManageMembersAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = "Join request moderator",
            Level = 10,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        role.Permissions.Add(new ServerRolePermission
        {
            RoleId = role.Id,
            PermissionId = ServerGovernanceIds.PermissionManageMembers,
            IsGranted = true,
            CreatedAt = now
        });
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = ArcaneLinkApiFactory.MemberMemberId,
            RoleId = role.Id,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });
        await db.SaveChangesAsync();
    }

    private static string JoinRequestsPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/join-requests";
    }

    private static string ApprovePath(Guid requestId)
    {
        return $"{JoinRequestsPath()}/{requestId}/approve";
    }

    private static string DeclinePath(Guid requestId)
    {
        return $"{JoinRequestsPath()}/{requestId}/decline";
    }
}
