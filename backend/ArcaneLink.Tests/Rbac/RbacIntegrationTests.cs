using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Rbac;

public sealed class RbacIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly HttpClient _client;

    public RbacIntegrationTests(ArcaneLinkApiFactory factory)
    {
        this._client = factory.CreateClient();
    }

    [Fact]
    public async Task Owner_CanCreateRoleWithPermissions()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("owner"));

        var response = await this._client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = "Moderator",
                PermissionCodes = ["manage_invites"]
            });
        response.EnsureSuccessStatusCode();

        var role = await response.Content.ReadFromJsonAsync<JsonObject>();

        Assert.Equal("Moderator", role?["title"]?.GetValue<string>());
        Assert.Contains(
            role?["permissions"]?.AsArray() ?? [],
            permission => permission?["code"]?.GetValue<string>() == "manage_invites");
    }

    [Fact]
    public async Task NonOwner_CannotCreateRole()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));

        var response = await this._client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = "Should Not Exist",
                PermissionCodes = ["manage_invites"]
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MemberRemoval_ProtectsOwnerAndRejectsNonOwner()
    {
        this._client.AuthorizeWith(await this._client.LoginAsync("member"));

        var memberRemoveOwnerResponse = await this._client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.OwnerMemberId}");

        Assert.Equal(HttpStatusCode.NotFound, memberRemoveOwnerResponse.StatusCode);

        this._client.AuthorizeWith(await this._client.LoginAsync("owner"));

        var ownerRemoveSelfResponse = await this._client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{ArcaneLinkApiFactory.OwnerMemberId}");

        Assert.Equal(HttpStatusCode.BadRequest, ownerRemoveSelfResponse.StatusCode);
    }

    [Fact]
    public async Task MemberWithoutManageMembers_CanLeaveServer()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("member"));

        var response = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/me");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DelegatedGovernancePermissions_AreEffectiveAndCannotEscalate()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddOutsiderMembershipAsync(factory);
        var suffix = Guid.NewGuid().ToString("N");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var managerRole = await CreateRoleAsync(
            client,
            $"Delegated manager {suffix}",
            ["manage_roles", "manage_members", "view_audit_log"],
            level: 10);
        var privilegedRole = await CreateRoleAsync(
            client,
            $"Privileged {suffix}",
            ["manage_server"],
            level: 20);
        var peerRole = await CreateRoleAsync(
            client,
            $"Peer {suffix}",
            ["manage_roles"],
            level: 10);
        var managerAssignment = await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            managerRole.Id);
        var privilegedAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            privilegedRole.Id);
        var roles = await client.GetFromJsonAsync<List<ServerRoleResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles") ?? [];
        var ownerRole = Assert.Single(roles, role => role.Code == "owner");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberPage = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members");
        var members = memberPage?.Items ?? [];
        var currentMember = Assert.Single(
            members,
            member => member.Id == ArcaneLinkApiFactory.MemberMemberId);
        Assert.Contains(
            currentMember.RoleAssignments,
            assignment => assignment.Id == managerAssignment.Id);

        using (var auditResponse = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/audit-logs"))
        {
            Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
        }

        var delegatedRole = await CreateRoleAsync(
            client,
            $"Delegated child {suffix}",
            ["manage_roles"]);
        Assert.True(delegatedRole.Level > managerRole.Level);
        await UpdateRolePermissionsAsync(
            client,
            delegatedRole.Id,
            ["manage_roles", "manage_members"]);

        await AssertRoleCreationDeniedAsync(
            client,
            $"Escalated server manager {suffix}",
            ["manage_server"]);
        await AssertRoleCreationDeniedAsync(
            client,
            $"Escalated invite manager {suffix}",
            ["manage_invites"]);
        await AssertRoleCreationDeniedAsync(
            client,
            $"Equal hierarchy {suffix}",
            ["manage_roles"],
            level: managerRole.Level);
        await AssertRoleUpdateDeniedAsync(
            client,
            delegatedRole.Id,
            ["manage_invites"]);
        await AssertRoleUpdateDeniedAsync(
            client,
            privilegedRole.Id,
            ["manage_server"]);
        await AssertRoleUpdateDeniedAsync(
            client,
            ownerRole.Id,
            ["manage_roles"]);
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            ownerRole.Id);
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            privilegedRole.Id);
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            peerRole.Id);

        using (var revokePrivilegedResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{privilegedAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, revokePrivilegedResponse.StatusCode);
        }

        using (var removePrivilegedMemberResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{OutsiderMemberId}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, removePrivilegedMemberResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var ownerRevokeResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{privilegedAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, ownerRevokeResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var delegatedAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            delegatedRole.Id);
        using (var revokeDelegatedResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{delegatedAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, revokeDelegatedResponse.StatusCode);
        }

        using var removeMemberResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{OutsiderMemberId}");
        Assert.Equal(HttpStatusCode.NoContent, removeMemberResponse.StatusCode);
    }

    [Fact]
    public async Task DelegatedRoleManager_CannotChangeRolesOfEqualOrHigherMember()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddOutsiderMembershipAsync(factory);
        var suffix = Guid.NewGuid().ToString("N");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var managerRole = await CreateRoleAsync(
            client,
            $"Hierarchy manager {suffix}",
            ["manage_roles"],
            level: 10);
        var peerRole = await CreateRoleAsync(
            client,
            $"Hierarchy peer {suffix}",
            [],
            level: 10);
        var assignCandidateRole = await CreateRoleAsync(
            client,
            $"Hierarchy assign candidate {suffix}",
            [],
            level: 20);
        var revokeCandidateRole = await CreateRoleAsync(
            client,
            $"Hierarchy revoke candidate {suffix}",
            [],
            level: 21);
        var reactivateCandidateRole = await CreateRoleAsync(
            client,
            $"Hierarchy reactivate candidate {suffix}",
            [],
            level: 22);

        await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            managerRole.Id);
        await AssignRoleAsync(client, OutsiderMemberId, peerRole.Id);
        var revokeCandidateAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            revokeCandidateRole.Id);
        var reactivateCandidateAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            reactivateCandidateRole.Id);
        using (var ownerRevokeResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{reactivateCandidateAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, ownerRevokeResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            assignCandidateRole.Id);
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            reactivateCandidateRole.Id);
        await AssertRoleAssignmentDeniedAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            assignCandidateRole.Id);
        await AssertRoleAssignmentDeniedAsync(
            client,
            ArcaneLinkApiFactory.OwnerMemberId,
            assignCandidateRole.Id);

        using var revokeResponse = await client.DeleteAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{revokeCandidateAssignment.Id}");
        Assert.Equal(HttpStatusCode.NotFound, revokeResponse.StatusCode);
    }

    [Fact]
    public async Task LegacyAdministrator_CannotDelegateManageServerPermission()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddOutsiderMembershipAsync(factory);
        var suffix = Guid.NewGuid().ToString("N");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var administratorRole = await CreateRoleAsync(
            client,
            $"Legacy administrator {suffix}",
            ["manage_server"],
            level: 10);
        var secondAdministratorRole = await CreateRoleAsync(
            client,
            $"Legacy administrator target {suffix}",
            ["manage_server"],
            level: 20);
        var ordinaryRole = await CreateRoleAsync(
            client,
            $"Ordinary role {suffix}",
            [],
            level: 30);

        await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            administratorRole.Id);
        var secondAdministratorAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            secondAdministratorRole.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        await AssertRoleCreationDeniedAsync(
            client,
            $"Delegated administrator {suffix}",
            ["manage_server"]);
        await AssertRoleUpdateDeniedAsync(
            client,
            ordinaryRole.Id,
            ["manage_server"]);
        await AssertRoleUpdateDeniedAsync(
            client,
            administratorRole.Id,
            []);
        await AssertRoleAssignmentDeniedAsync(
            client,
            OutsiderMemberId,
            secondAdministratorRole.Id);

        using (var revokeAdministratorResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{secondAdministratorAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, revokeAdministratorResponse.StatusCode);
        }

        var delegatedOrdinaryRole = await CreateRoleAsync(
            client,
            $"Delegated ordinary role {suffix}",
            []);
        Assert.DoesNotContain(
            delegatedOrdinaryRole.Permissions,
            permission => permission.Code == "manage_server");
    }

    [Fact]
    public async Task RoleReactivation_RefreshesAssignmentMetadataAndAudit()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        await AddOutsiderMembershipAsync(factory);
        var suffix = Guid.NewGuid().ToString("N");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var managerRole = await CreateRoleAsync(
            client,
            $"Reactivation manager {suffix}",
            ["manage_roles"],
            level: 10);
        var delegatedRole = await CreateRoleAsync(
            client,
            $"Reactivation target {suffix}",
            [],
            level: 20);
        await AssignRoleAsync(
            client,
            ArcaneLinkApiFactory.MemberMemberId,
            managerRole.Id);
        var originalAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            delegatedRole.Id);

        using (var revokeResponse = await client.DeleteAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/member-roles/{originalAssignment.Id}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, revokeResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var reactivatedAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            delegatedRole.Id);

        Assert.Equal(originalAssignment.Id, reactivatedAssignment.Id);
        Assert.True(reactivatedAssignment.AssignedAt >= originalAssignment.AssignedAt);
        var idempotentAssignment = await AssignRoleAsync(
            client,
            OutsiderMemberId,
            delegatedRole.Id);
        Assert.Equal(reactivatedAssignment.Id, idempotentAssignment.Id);
        Assert.Equal(reactivatedAssignment.AssignedAt, idempotentAssignment.AssignedAt);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storedAssignment = db.ServerMemberRoles.Single(
            assignment => assignment.Id == originalAssignment.Id);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, storedAssignment.AssignedByUserId);
        Assert.Null(storedAssignment.RevokedAt);
        Assert.Null(storedAssignment.RevokedByUserId);
        Assert.Equal(
            2,
            db.ServerAuditLogs.Count(audit =>
                audit.ServerId == ArcaneLinkApiFactory.ServerId &&
                audit.EventTypeId == ServerGovernanceIds.AuditRoleAssigned &&
                audit.RelatedRoleId == delegatedRole.Id));
    }

    [Fact]
    public async Task MemberList_UsesStableCompositeCursor_AndCapsPageSize()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var firstPage = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?limit=1");

        Assert.NotNull(firstPage);
        Assert.Equal(2, firstPage.TotalCount);
        var firstMember = Assert.Single(firstPage.Items);
        Assert.Equal(ArcaneLinkApiFactory.OwnerMemberId, firstMember.Id);
        Assert.NotNull(firstPage.NextCursor);

        var cursor = firstPage.NextCursor!;
        var cursorJoinedAt = Uri.EscapeDataString(cursor.JoinedAt.ToString("O"));
        var secondPage = await client.GetFromJsonAsync<ServerMemberPageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?limit=1&afterPriority={cursor.Priority}&afterJoinedAt={cursorJoinedAt}&afterId={cursor.Id}");

        Assert.NotNull(secondPage);
        var secondMember = Assert.Single(secondPage.Items);
        Assert.NotEqual(firstMember.Id, secondMember.Id);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, secondMember.Id);
        Assert.Null(secondPage.NextCursor);

        var memberByUserId = await client.GetFromJsonAsync<ServerMemberDetailsResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/by-user/{ArcaneLinkApiFactory.MemberUserId}");
        Assert.NotNull(memberByUserId);
        Assert.Equal(ArcaneLinkApiFactory.MemberMemberId, memberByUserId.Id);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, memberByUserId.UserId);

        using var oversizedPageResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?limit=101");
        Assert.Equal(HttpStatusCode.BadRequest, oversizedPageResponse.StatusCode);

        using var partialCursorResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members?afterPriority=0");
        Assert.Equal(HttpStatusCode.BadRequest, partialCursorResponse.StatusCode);
    }

    private static readonly Guid OutsiderMemberId =
        Guid.Parse("cccccccc-0000-0000-0000-000000000003");

    private static async Task AddOutsiderMembershipAsync(ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
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
        int? level = null)
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

    private static async Task<ServerRoleResponse> UpdateRolePermissionsAsync(
        HttpClient client,
        Guid roleId,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roleId}/permissions",
            new UpdateServerRolePermissionsRequest
            {
                PermissionCodes = permissionCodes
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ServerRoleResponse>())!;
    }

    private static async Task AssertRoleCreationDeniedAsync(
        HttpClient client,
        string title,
        IReadOnlyList<string> permissionCodes,
        int? level = null)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = title,
                Level = level,
                PermissionCodes = permissionCodes
            });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task AssertRoleUpdateDeniedAsync(
        HttpClient client,
        Guid roleId,
        IReadOnlyList<string> permissionCodes)
    {
        using var response = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles/{roleId}/permissions",
            new UpdateServerRolePermissionsRequest
            {
                PermissionCodes = permissionCodes
            });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task AssertRoleAssignmentDeniedAsync(
        HttpClient client,
        Guid memberId,
        Guid roleId)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/members/{memberId}/roles",
            new AssignServerRoleRequest { RoleId = roleId });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
