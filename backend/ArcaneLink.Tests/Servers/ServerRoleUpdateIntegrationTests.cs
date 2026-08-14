using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleUpdateIntegrationTests
{
    [Fact]
    public async Task UnifiedPatch_UpdatesEditableStateRevisionsAndAuditAtomically()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Original role", "Original description");
        var before = await ReadSnapshotAsync(factory, role.Id);

        using var response = await client.PatchAsJsonAsync(
            RolePath(role.Id),
            new UpdateServerRoleRequest
            {
                Title = "  Updated role  ",
                Description = "  Updated description  ",
                Color = "#AABBCCDD",
                Mentionable = true,
                PermissionCodes = ["manage_members"],
                ExpectedVersion = role.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var updated = (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        var after = await ReadSnapshotAsync(factory, role.Id);

        Assert.Equal("Updated role", updated.Title);
        Assert.Equal("Updated description", updated.Description);
        Assert.Equal("#aabbccdd", updated.Color);
        Assert.True(updated.Mentionable);
        Assert.Equal(["manage_members"], updated.Permissions.Select(item => item.Code));
        Assert.NotEqual(role.Version, updated.Version);

        Assert.Equal(updated.Version, after.RoleVersion);
        Assert.Equal("Updated role", after.Title);
        Assert.Equal("Updated description", after.Description);
        Assert.Equal("#aabbccdd", after.Color);
        Assert.True(after.Mentionable);
        Assert.Equal("manage_members", after.PermissionCodes);
        Assert.NotEqual(before.ServerAuthorizationVersion, after.ServerAuthorizationVersion);
        Assert.NotEqual(before.SpaceAclRevision, after.SpaceAclRevision);
        Assert.NotEqual(before.RoleVersion, after.RoleVersion);
        Assert.True(after.RoleUpdatedAt > before.RoleUpdatedAt);
        Assert.Equal(before.RoleUpdateAuditCount + 1, after.RoleUpdateAuditCount);

        var audit = await ReadLatestUpdateAuditAsync(factory, role.Id);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, audit.ActorUserId);
        Assert.Equal(role.Id, audit.RelatedRoleId);
        Assert.NotNull(audit.Payload);
        Assert.Contains("\"before\"", audit.Payload, StringComparison.Ordinal);
        Assert.Contains("\"after\"", audit.Payload, StringComparison.Ordinal);
        Assert.Contains("Original role", audit.Payload, StringComparison.Ordinal);
        Assert.Contains("Updated role", audit.Payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UnifiedPatch_WithMetadataOnlyChange_DoesNotBumpAuthorizationRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Metadata role");
        var before = await ReadSnapshotAsync(factory, role.Id);

        using var response = await client.PatchAsJsonAsync(
            RolePath(role.Id),
            new UpdateServerRoleRequest
            {
                Title = "Updated metadata role",
                Description = "Metadata only",
                Color = "#A1B2C3",
                Mentionable = true,
                PermissionCodes = ["manage_invites"],
                ExpectedVersion = role.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var updated = (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        var after = await ReadSnapshotAsync(factory, role.Id);

        Assert.NotEqual(role.Version, updated.Version);
        Assert.Equal(before.ServerAuthorizationVersion, after.ServerAuthorizationVersion);
        Assert.Equal(before.SpaceAclRevision, after.SpaceAclRevision);
        Assert.NotEqual(before.RoleVersion, after.RoleVersion);
        Assert.True(after.RoleUpdatedAt > before.RoleUpdatedAt);
        Assert.Equal(before.RoleUpdateAuditCount + 1, after.RoleUpdateAuditCount);
        Assert.Equal("manage_invites", after.PermissionCodes);
    }

    [Fact]
    public async Task UnifiedPatch_WithEquivalentNormalizedState_IsNoOp()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "No-op role");
        var before = await ReadSnapshotAsync(factory, role.Id);

        using var response = await client.PatchAsJsonAsync(
            RolePath(role.Id),
            new UpdateServerRoleRequest
            {
                Title = "  No-op role  ",
                Description = "   ",
                Color = null,
                Mentionable = false,
                PermissionCodes = ["MANAGE_INVITES", " manage_invites "],
                ExpectedVersion = role.Version
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var updated = (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        var after = await ReadSnapshotAsync(factory, role.Id);

        Assert.Equal(role.Version, updated.Version);
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task UnifiedPatch_WithStaleVersion_ReturnsConflictWithoutMutation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Conflict role");

        using (var firstResponse = await client.PatchAsJsonAsync(
                   RolePath(role.Id),
                   new UpdateServerRoleRequest
                   {
                       Title = "Current role",
                       Description = null,
                       Color = "#112233",
                       Mentionable = false,
                       PermissionCodes = ["manage_invites"],
                       ExpectedVersion = role.Version
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(firstResponse);
        }

        var beforeStaleWrite = await ReadSnapshotAsync(factory, role.Id);
        using var staleResponse = await client.PatchAsJsonAsync(
            RolePath(role.Id),
            new UpdateServerRoleRequest
            {
                Title = "Must not be stored",
                Description = "stale",
                Color = "#445566",
                Mentionable = true,
                PermissionCodes = ["manage_members"],
                ExpectedVersion = role.Version
            });

        Assert.Equal(HttpStatusCode.Conflict, staleResponse.StatusCode);
        var error = await staleResponse.Content.ReadFromJsonAsync<RoleUpdateErrorResponse>();
        Assert.Equal("server_role_conflict", error?.Code);
        Assert.Equal(beforeStaleWrite, await ReadSnapshotAsync(factory, role.Id));
    }

    [Fact]
    public async Task UnifiedPatch_RejectsEmptyVersionAndUnknownPermissionWithoutMutation()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Validation role");
        var before = await ReadSnapshotAsync(factory, role.Id);

        using (var emptyVersionResponse = await client.PatchAsJsonAsync(
                   RolePath(role.Id),
                   new UpdateServerRoleRequest
                   {
                       Title = "Must not be stored",
                       Description = null,
                       Color = null,
                       Mentionable = false,
                       PermissionCodes = ["manage_invites"],
                       ExpectedVersion = Guid.Empty
                   }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, emptyVersionResponse.StatusCode);
            var error = await emptyVersionResponse.Content
                .ReadFromJsonAsync<RoleUpdateErrorResponse>();
            Assert.Equal("invalid_role_update", error?.Code);
        }

        Assert.Equal(before, await ReadSnapshotAsync(factory, role.Id));

        using (var unknownPermissionResponse = await client.PatchAsJsonAsync(
                   RolePath(role.Id),
                   new UpdateServerRoleRequest
                   {
                       Title = "Must not be stored",
                       Description = null,
                       Color = null,
                       Mentionable = false,
                       PermissionCodes = ["permission_that_does_not_exist"],
                       ExpectedVersion = role.Version
                   }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, unknownPermissionResponse.StatusCode);
            var error = await unknownPermissionResponse.Content
                .ReadFromJsonAsync<RoleUpdateErrorResponse>();
            Assert.Equal("invalid_role_update", error?.Code);
        }

        Assert.Equal(before, await ReadSnapshotAsync(factory, role.Id));
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title,
        string? description = null)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                Description = description,
                PermissionCodes = ["manage_invites"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static string RolePath(Guid roleId) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roleId}";

    private static async Task<RoleUpdateSnapshot> ReadSnapshotAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var server = await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new
            {
                item.AuthorizationVersion,
                item.SpaceAclRevision
            })
            .SingleAsync();
        var role = await db.ServerRoles
            .AsNoTracking()
            .Include(item => item.Permissions)
                .ThenInclude(item => item.Permission)
            .SingleAsync(item => item.Id == roleId);
        var roleUpdateAuditCount = await db.ServerAuditLogs
            .AsNoTracking()
            .CountAsync(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.RelatedRoleId == roleId &&
                item.EventTypeId == ServerGovernanceIds.AuditRoleUpdated);

        return new RoleUpdateSnapshot(
            server.AuthorizationVersion,
            server.SpaceAclRevision,
            role.Version,
            role.UpdatedAt,
            role.Title,
            role.Description,
            role.Color,
            role.Mentionable,
            string.Join(
                '|',
                role.Permissions
                    .Where(item => item.IsGranted)
                    .Select(item => item.Permission.Code)
                    .OrderBy(code => code, StringComparer.Ordinal)),
            roleUpdateAuditCount);
    }

    private static async Task<AuditSnapshot> ReadLatestUpdateAuditAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ServerAuditLogs
            .AsNoTracking()
            .Where(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.RelatedRoleId == roleId &&
                item.EventTypeId == ServerGovernanceIds.AuditRoleUpdated)
            .OrderByDescending(item => item.CreatedAt)
            .ThenByDescending(item => item.Id)
            .Select(item => new AuditSnapshot(
                item.ActorUserId,
                item.RelatedRoleId,
                item.Payload))
            .FirstAsync();
    }

    private sealed record RoleUpdateSnapshot(
        Guid ServerAuthorizationVersion,
        Guid SpaceAclRevision,
        Guid RoleVersion,
        DateTime RoleUpdatedAt,
        string Title,
        string? Description,
        string? Color,
        bool Mentionable,
        string PermissionCodes,
        int RoleUpdateAuditCount);

    private sealed record AuditSnapshot(
        Guid? ActorUserId,
        Guid? RelatedRoleId,
        string? Payload);

    private sealed class RoleUpdateErrorResponse
    {
        public string? Code { get; set; }
    }
}
