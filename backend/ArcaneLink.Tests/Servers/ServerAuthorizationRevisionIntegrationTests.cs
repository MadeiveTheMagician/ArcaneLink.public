using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerAuthorizationRevisionIntegrationTests
{
    [Fact]
    public async Task RolePermissionAndAssignmentMutations_BumpServerRoleAndMemberRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var rolesPath = $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles";
        var beforeCreateAuthorization = await ReadServerAuthorizationAsync(factory);

        using var createResponse = await client.PostAsJsonAsync(
            rolesPath,
            new CreateServerRoleRequest
            {
                Title = "Revision metadata role",
                PermissionCodes = ["manage_invites"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var role = (await createResponse.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
        var before = await ReadRevisionsAsync(factory, role.Id);

        Assert.NotEqual(beforeCreateAuthorization, before.ServerAuthorization);

        using var updateResponse = await client.PatchAsJsonAsync(
            $"{rolesPath}/{role.Id}/permissions",
            new UpdateServerRolePermissionsRequest
            {
                PermissionCodes = ["manage_members"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        var afterPermissionUpdate = await ReadRevisionsAsync(factory, role.Id);

        Assert.NotEqual(before.ServerAuthorization, afterPermissionUpdate.ServerAuthorization);
        Assert.NotEqual(before.Role, afterPermissionUpdate.Role);
        Assert.Equal(before.MemberRoles, afterPermissionUpdate.MemberRoles);

        using var assignResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/" +
            $"{ArcaneLinkApiFactory.MemberMemberId}/roles",
            new AssignServerRoleRequest { RoleId = role.Id });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(assignResponse);
        var afterAssignment = await ReadRevisionsAsync(factory, role.Id);

        Assert.NotEqual(
            afterPermissionUpdate.ServerAuthorization,
            afterAssignment.ServerAuthorization);
        Assert.NotEqual(
            afterPermissionUpdate.MemberRoles,
            afterAssignment.MemberRoles);
        Assert.Equal(afterPermissionUpdate.Role, afterAssignment.Role);
    }

    [Fact]
    public async Task OwnerRolePermissionRepair_BumpsServerAndRoleRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var initialRolesResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles"))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(initialRolesResponse);
        }

        Guid ownerRoleId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ownerRole = await db.ServerRoles
                .Include(role => role.Permissions)
                .SingleAsync(role =>
                    role.ServerId == ArcaneLinkApiFactory.ServerId &&
                    role.Code == "owner");
            ownerRoleId = ownerRole.Id;
            var permission = ownerRole.Permissions.Single(item =>
                item.PermissionId == ServerGovernanceIds.PermissionManageInvites);
            db.ServerRolePermissions.Remove(permission);
            await db.SaveChangesAsync();
        }

        var beforeRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);
        using var rolesResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(rolesResponse);
        var afterRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);

        Assert.NotEqual(beforeRepair.ServerAuthorization, afterRepair.ServerAuthorization);
        Assert.NotEqual(beforeRepair.Role, afterRepair.Role);
        Assert.Equal(beforeRepair.MemberRoles, afterRepair.MemberRoles);
    }

    [Fact]
    public async Task OwnerRoleDeniedPermissionRepair_RegrantsPermissionAndBumpsRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var initialRolesResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles"))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(initialRolesResponse);
        }

        Guid ownerRoleId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var ownerRole = await db.ServerRoles
                .Include(role => role.Permissions)
                .SingleAsync(role =>
                    role.ServerId == ArcaneLinkApiFactory.ServerId &&
                    role.Code == "owner");
            ownerRoleId = ownerRole.Id;
            ownerRole.Permissions.Single(item =>
                item.PermissionId == ServerGovernanceIds.PermissionManageInvites).IsGranted = false;
            await db.SaveChangesAsync();
        }

        var beforeRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);
        using var rolesResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(rolesResponse);
        var afterRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var isGranted = await db.ServerRolePermissions
                .Where(item =>
                    item.RoleId == ownerRoleId &&
                    item.PermissionId == ServerGovernanceIds.PermissionManageInvites)
                .Select(item => item.IsGranted)
                .SingleAsync();
            Assert.True(isGranted);
        }

        Assert.NotEqual(beforeRepair.ServerAuthorization, afterRepair.ServerAuthorization);
        Assert.NotEqual(beforeRepair.Role, afterRepair.Role);
        Assert.Equal(beforeRepair.MemberRoles, afterRepair.MemberRoles);
    }

    [Fact]
    public async Task OwnerRoleAssignmentRepair_ReactivatesExistingRowAndBumpsRevisions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var initialRolesResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles"))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(initialRolesResponse);
        }

        Guid ownerRoleId;
        Guid assignmentId;
        DateTime previousAssignedAt;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            ownerRoleId = await db.ServerRoles
                .Where(role =>
                    role.ServerId == ArcaneLinkApiFactory.ServerId &&
                    role.Code == "owner")
                .Select(role => role.Id)
                .SingleAsync();
            var assignment = await db.ServerMemberRoles.SingleAsync(item =>
                item.ServerId == ArcaneLinkApiFactory.ServerId &&
                item.MemberId == ArcaneLinkApiFactory.OwnerMemberId &&
                item.RoleId == ownerRoleId);
            assignmentId = assignment.Id;
            previousAssignedAt = assignment.AssignedAt;
            assignment.RevokedAt = DateTime.UtcNow;
            assignment.RevokedByUserId = ArcaneLinkApiFactory.OwnerUserId;
            await db.SaveChangesAsync();
        }

        var beforeRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);
        using var rolesResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(rolesResponse);
        var afterRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var repairedAssignment = await db.ServerMemberRoles
                .AsNoTracking()
                .SingleAsync(item =>
                    item.ServerId == ArcaneLinkApiFactory.ServerId &&
                    item.MemberId == ArcaneLinkApiFactory.OwnerMemberId &&
                    item.RoleId == ownerRoleId);
            Assert.Equal(assignmentId, repairedAssignment.Id);
            Assert.Null(repairedAssignment.RevokedAt);
            Assert.Null(repairedAssignment.RevokedByUserId);
            Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, repairedAssignment.AssignedByUserId);
            Assert.True(repairedAssignment.AssignedAt > previousAssignedAt);
        }

        Assert.NotEqual(beforeRepair.ServerAuthorization, afterRepair.ServerAuthorization);
        Assert.Equal(beforeRepair.Role, afterRepair.Role);
        Assert.NotEqual(beforeRepair.MemberRoles, afterRepair.MemberRoles);

        using (var repeatedRolesResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles"))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(repeatedRolesResponse);
        }

        var afterRepeatedRepair = await ReadRevisionsAsync(
            factory,
            ownerRoleId,
            ArcaneLinkApiFactory.OwnerMemberId);
        Assert.Equal(afterRepair, afterRepeatedRepair);
    }

    private static async Task<RevisionSnapshot> ReadRevisionsAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId,
        Guid? memberId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var serverAuthorization = await db.Servers
            .AsNoTracking()
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.AuthorizationVersion)
            .SingleAsync();
        var roleVersion = await db.ServerRoles
            .AsNoTracking()
            .Where(role => role.Id == roleId)
            .Select(role => role.Version)
            .SingleAsync();
        var memberRolesVersion = await db.ServerMembers
            .AsNoTracking()
            .Where(member => member.Id == (memberId ?? ArcaneLinkApiFactory.MemberMemberId))
            .Select(member => member.RolesVersion)
            .SingleAsync();

        return new RevisionSnapshot(
            serverAuthorization,
            roleVersion,
            memberRolesVersion);
    }

    private static async Task<Guid> ReadServerAuthorizationAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Servers
            .AsNoTracking()
            .Where(server => server.Id == ArcaneLinkApiFactory.ServerId)
            .Select(server => server.AuthorizationVersion)
            .SingleAsync();
    }

    private sealed record RevisionSnapshot(
        Guid ServerAuthorization,
        Guid Role,
        Guid MemberRoles);
}
