using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerRoleDeletionIntegrationTests
{
    [Fact]
    public async Task DeleteUnusedRole_SoftDeletesWithRevisionAndAudit()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Unused role");
        var before = await ReadServerRevisionAsync(factory);

        var impact = await client
            .GetFromJsonAsync<ServerRoleDeletionImpactResponse>(ImpactPath(role.Id));
        Assert.NotNull(impact);
        Assert.True(impact.CanDelete);
        Assert.False(impact.HasBlockingDependencies);

        using var response = await client.DeleteAsync(DeletePath(role));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var roles = await client.GetFromJsonAsync<List<ServerRoleResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        Assert.DoesNotContain(roles!, item => item.Id == role.Id);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var deleted = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(item => item.Id == role.Id);
        Assert.NotNull(deleted.DeletedAt);
        Assert.NotEqual(role.Version, deleted.Version);
        var after = await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new ServerRevisionSnapshot(
                item.AuthorizationVersion,
                item.SpaceAclRevision))
            .SingleAsync();
        Assert.NotEqual(before.AuthorizationVersion, after.AuthorizationVersion);
        Assert.NotEqual(before.SpaceAclRevision, after.SpaceAclRevision);
        var audit = await db.ServerAuditLogs
            .AsNoTracking()
            .SingleAsync(item =>
                item.RelatedRoleId == role.Id &&
                item.EventTypeId == ServerGovernanceIds.AuditRoleUpdated);
        Assert.Contains("role_deleted", audit.Payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DeleteRole_BlocksActiveAssignmentUntilItIsRevoked()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Assigned role");
        var assignment = await AssignRoleAsync(client, role.Id);

        var impact = await client
            .GetFromJsonAsync<ServerRoleDeletionImpactResponse>(ImpactPath(role.Id));
        Assert.NotNull(impact);
        Assert.Equal(1, impact.DirectAssignmentCount);
        Assert.True(impact.HasBlockingDependencies);
        Assert.False(impact.CanDelete);

        using (var blocked = await client.DeleteAsync(DeletePath(role)))
        {
            Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
            var error = await blocked.Content
                .ReadFromJsonAsync<DeleteRoleErrorResponse>();
            Assert.Equal("server_role_has_dependencies", error?.Code);
            Assert.Equal(1, error?.Impact?.DirectAssignmentCount);
        }

        using (var revoke = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/" +
                   assignment.Id))
        {
            Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        }

        using var deleted = await client.DeleteAsync(DeletePath(role));
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task DeletionImpact_ReportsAclSpaceAndDisplayColorDependencies()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Dependency role");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var space = await db.Spaces.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.TextSpaceId);
            space.RequiredServerRoleId = role.Id;
            space.ProtectionRoleId = role.Id;
            space.CreatedWithRoleId = role.Id;
            var member = await db.ServerMembers.SingleAsync(item =>
                item.Id == ArcaneLinkApiFactory.MemberMemberId);
            member.DisplayColorMode = ServerMemberDisplayColorModeCodes.Role;
            member.DisplayColorRoleId = role.Id;
            db.SpacePermissionOverrides.Add(new SpacePermissionOverride
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                SpaceId = ArcaneLinkApiFactory.TextSpaceId,
                RoleId = role.Id,
                ProtectionRoleId = role.Id,
                PermissionId = SpacePermissionIds.ViewSpace,
                Allow = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var impact = await client
            .GetFromJsonAsync<ServerRoleDeletionImpactResponse>(ImpactPath(role.Id));

        Assert.NotNull(impact);
        Assert.Equal(1, impact.RoleAclCount);
        Assert.Equal(1, impact.ProtectedAclCount);
        Assert.Equal(1, impact.RequiredSpaceCount);
        Assert.Equal(1, impact.ProtectedSpaceCount);
        Assert.Equal(1, impact.CreatedWithRoleSpaceCount);
        Assert.Equal(1, impact.DisplayColorMemberCount);
        Assert.True(impact.HasBlockingDependencies);
        Assert.False(impact.CanDelete);
        using var blocked = await client.DeleteAsync(DeletePath(role));
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
    }

    [Fact]
    public async Task DeleteRole_WithStaleVersion_DoesNotMutateRole()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var role = await CreateRoleAsync(client, "Stale delete");
        using (var update = await client.PatchAsJsonAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{role.Id}",
                   new UpdateServerRoleRequest
                   {
                       Title = "Updated before delete",
                       PermissionCodes = [],
                       ExpectedVersion = role.Version
                   }))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(update);
        }

        using var response = await client.DeleteAsync(DeletePath(role));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.ServerRoles
            .AsNoTracking()
            .SingleAsync(item => item.Id == role.Id);
        Assert.Null(stored.DeletedAt);
        Assert.Equal("Updated before delete", stored.Title);
    }

    private static async Task<ServerRoleResponse> CreateRoleAsync(
        HttpClient client,
        string title)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest { Title = title });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task<ServerMemberRoleResponse> AssignRoleAsync(
        HttpClient client,
        Guid roleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
            $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = roleId });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content
            .ReadFromJsonAsync<ServerMemberRoleResponse>())!;
    }

    private static string ImpactPath(Guid roleId) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roleId}/" +
        "deletion-impact";

    private static string DeletePath(ServerRoleResponse role) =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{role.Id}?" +
        $"expectedVersion={role.Version}";

    private static async Task<ServerRevisionSnapshot> ReadServerRevisionAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Servers
            .AsNoTracking()
            .Where(item => item.Id == ArcaneLinkApiFactory.ServerId)
            .Select(item => new ServerRevisionSnapshot(
                item.AuthorizationVersion,
                item.SpaceAclRevision))
            .SingleAsync();
    }

    private sealed record ServerRevisionSnapshot(
        Guid AuthorizationVersion,
        Guid SpaceAclRevision);

    private sealed class DeleteRoleErrorResponse
    {
        public string? Code { get; set; }
        public ServerRoleDeletionImpactResponse? Impact { get; set; }
    }
}
